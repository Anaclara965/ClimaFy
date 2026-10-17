const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const model = require("../app/models/recuperacaoSenhaModel");
const usuarios = require("../app/models/usuarioModel");
const preferencias = require("../app/models/preferenciaModel");
const mail = require("../app/services/emailService");
const { compararCodigo } = require("../app/helpers/codigoVerificacao");
const { criarLimiteRecuperacao } = require("../app/middlewares/protegerRecuperacaoSenha");

test("limite por IP não depende da conta nem permite crescer memória sem limite", () => {
  let tempo = 1000, nexts = 0;
  const limite = criarLimiteRecuperacao({ limite: 2, janelaMs: 60000, agora: () => tempo });
  const res = { set() {}, status(n) { this.statusCode = n; return this; }, render() {} };
  const pedir = ip => limite({ ip }, res, () => nexts++);
  pedir("ip-1"); pedir("ip-1"); pedir("ip-1");
  assert.equal(nexts, 2); assert.equal(res.statusCode, 429);
  tempo += 60001; pedir("ip-1"); assert.equal(nexts, 3);
  for (let i = 2; i <= 5000; i++) pedir("ip-" + i);
  const antes = nexts; pedir("ip-novo"); assert.equal(nexts, antes);
});

test("recuperação via formulário existente com e-mail e banco simulados", async t => {
  const usuario = { id: 7, public_id: "uuid-teste", nome: "Teste", email: "pessoa@example.com", papel: "moderador",
    status: "ativo", email_verificado_em: new Date(), senha_hash: await bcrypt.hash("SenhaAntiga1!", 4) };
  let registro, codigoEnviado, emissoes = 0, trocas = 0, falharEmail = false, falharBanco = false, avisos = 0;
  t.mock.method(console, "warn", () => {});
  t.mock.method(model, "emitirCodigo", async dados => {
    emissoes++;
    if (falharBanco) throw new Error("SQL e credencial que não devem sair na resposta");
    if (dados.email !== usuario.email || registro) return null;
    registro = { ...dados, consumido: false }; return { usuarioId: 7, email: usuario.email };
  });
  t.mock.method(model, "redefinirSenha", async dados => {
    trocas++;
    if (dados.email !== usuario.email || !registro || registro.consumido || !compararCodigo(dados.codigo, registro.codigoHash)) return { ok: false };
    assert.notEqual(dados.senhaHash, "NovaSenha123!");
    assert.equal(await bcrypt.compare("NovaSenha123!", dados.senhaHash), true);
    registro.consumido = true; usuario.senha_hash = dados.senhaHash; return { ok: true };
  });
  t.mock.method(mail, "enviarCodigoVerificacao", async (email, codigo, opcoes) => {
    assert.equal(email, usuario.email); assert.equal(opcoes.finalidade, "recuperacao_senha");
    codigoEnviado = codigo;
    if (falharEmail) throw new Error("smtp-segredo-nao-expor");
    return { enviado: true };
  });
  t.mock.method(mail, "enviarEmail", async dados => { avisos++; assert.equal(dados.para, usuario.email); return { enviado: true }; });
  t.mock.method(usuarios, "buscarPorEmail", async email => email === usuario.email ? { ...usuario } : null);
  t.mock.method(usuarios, "buscarPorId", async () => ({ ...usuario }));
  t.mock.method(usuarios, "registrarAcesso", async () => {});
  t.mock.method(preferencias, "temPreferencias", async () => true);

  const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: true }));
  app.use(session({ name: "climafy.sid", secret: "somente-teste-recuperacao-senha", resave: false, saveUninitialized: false }));
  app.set("view engine", "ejs"); app.set("views", path.join(__dirname, "../app/views"));
  app.use((req, res, next) => { res.locals.usuario = req.session.usuario ?? null; next(); });
  app.use(require("../app/routes/router"));
  app.use((erro, req, res, next) => res.status(500).send("Erro interno do servidor"));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening"); const origem = `http://127.0.0.1:${servidor.address().port}`;
  async function pedir(rota, { cookie, dados, json = false } = {}) {
    const resposta = await fetch(origem + rota, { redirect: "manual", method: dados ? "POST" : "GET", headers: {
      ...(cookie ? { Cookie: cookie } : {}), ...(dados ? { "Content-Type": json ? "application/json" : "application/x-www-form-urlencoded" } : {}),
    }, ...(dados ? { body: json ? JSON.stringify(dados) : new URLSearchParams(dados) } : {}) });
    return { status: resposta.status, texto: await resposta.text(), destino: resposta.headers.get("location"),
      cookie: resposta.headers.get("set-cookie")?.split(";")[0], cache: resposta.headers.get("cache-control") };
  }
  let cookie, csrf, cookieLogado;
  const nova = { email: usuario.email, senha: "NovaSenha123!", "confirma-senha": "NovaSenha123!" };
  await t.test("login contém link real; recuperação usa login.ejs com CSRF e sem cache", async () => {
    assert.match((await pedir("/login")).texto, /href="\/recuperar-senha"/);
    const inicio = await pedir("/recuperar-senha");
    assert.equal(inicio.status, 200); assert.equal(inicio.cache, "no-store");
    cookie = inicio.cookie; csrf = inicio.texto.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
    assert.match(inicio.texto, /action="\/recuperar-senha"/);
    assert.doesNotMatch(inicio.texto, /id="recovery-password"/);
    cookieLogado = (await pedir("/login", { dados: { email: usuario.email, senha: "SenhaAntiga1!" } })).cookie;
    assert.equal((await pedir("/new-report", { cookie: cookieLogado })).status, 200);
  });
  await t.test("sem CSRF, token de outra sessão e tipos inválidos não chegam à emissão", async () => {
    assert.equal((await pedir("/recuperar-senha", { dados: { email: usuario.email } })).status, 403);
    assert.equal((await pedir("/recuperar-senha", { dados: { email: usuario.email, _csrf: csrf } })).status, 403);
    for (const email of [[], {}, "invalido", "a".repeat(195) + "@example.com"]) {
      assert.equal((await pedir("/recuperar-senha", { cookie, json: true, dados: { email, _csrf: csrf } })).status, 422);
    }
    assert.equal(emissoes, 0);
  });
  let respostaExistente;
  await t.test("e-mail normalizado gera hash de código; resposta nunca contém o código", async () => {
    respostaExistente = await pedir("/recuperar-senha", { cookie, dados: { email: "  PESSOA@EXAMPLE.COM  ", _csrf: csrf } });
    assert.equal(respostaExistente.status, 200); assert.equal(emissoes, 1);
    assert.match(codigoEnviado, /^\d{6}$/); assert.equal(compararCodigo(codigoEnviado, registro.codigoHash), true);
    assert.doesNotMatch(respostaExistente.texto, new RegExp(codigoEnviado));
    assert.match(respostaExistente.texto, /action="\/resetar-senha"/);
    assert.match(respostaExistente.texto, /Se esse e-mail pertencer/);
  });
  await t.test("conta inexistente e pedido limitado recebem mesma mensagem e estrutura", async () => {
    const desconhecido = await pedir("/recuperar-senha", { cookie, dados: { email: "naoexiste@example.com", _csrf: csrf } });
    const limitado = await pedir("/recuperar-senha", { cookie, dados: { email: usuario.email, _csrf: csrf } });
    assert.equal(desconhecido.status, respostaExistente.status);
    assert.equal(desconhecido.texto.replaceAll("naoexiste@example.com", usuario.email), respostaExistente.texto);
    assert.equal(limitado.texto, respostaExistente.texto);
  });
  await t.test("senha fraca, confirmação diferente, código/tipos inválidos são recusados sem model", async () => {
    for (const dados of [
      { senha: "fraca", "confirma-senha": "fraca" }, { "confirma-senha": "Diferente123!" },
      { codigo: "abc" }, { senha: [] }, { senha: {}, "confirma-senha": {} },
      { email: [] }, { senha: "A1!" + "é".repeat(36) },
    ]) {
      const resposta = await pedir("/resetar-senha", { cookie, json: true, dados: { ...nova, codigo: codigoEnviado, _csrf: csrf, ...dados } });
      assert.equal(resposta.status, 422);
      assert.doesNotMatch(resposta.texto, /value="NovaSenha123!"/);
      assert.doesNotMatch(resposta.texto, new RegExp('value="' + codigoEnviado + '"'));
    }
    assert.equal(trocas, 0);
  });
  await t.test("código errado e conta inexistente não criam sessão ou anunciam sucesso", async () => {
    for (const dados of [{ ...nova, codigo: "abcdef" }, { ...nova, codigo: codigoEnviado === "111111" ? "222222" : "111111" },
      { ...nova, email: "naoexiste@example.com", codigo: codigoEnviado }]) {
      const resposta = await pedir("/resetar-senha", { cookie, dados: { ...dados, _csrf: csrf } });
      assert.equal(resposta.status, 422); assert.doesNotMatch(resposta.texto, /Senha redefinida!/);
      assert.equal((await pedir("/new-report", { cookie })).status, 303);
    }
  });
  await t.test("troca válida volta ao login, revoga sessão antiga e exige nova senha", async () => {
    const antes = { papel: usuario.papel, verificado: usuario.email_verificado_em, status: usuario.status };
    const resposta = await pedir("/resetar-senha", { cookie, dados: { ...nova, codigo: codigoEnviado, _csrf: csrf, usuarioId: 999, papel: "administrador" } });
    assert.equal(resposta.status, 303); assert.equal(resposta.destino, "/login");
    assert.notEqual(resposta.cookie, cookie); assert.equal(avisos, 1);
    assert.deepEqual({ papel: usuario.papel, verificado: usuario.email_verificado_em, status: usuario.status }, antes);
    assert.equal((await pedir("/new-report", { cookie: resposta.cookie })).status, 303);
    assert.equal((await pedir("/new-report", { cookie: cookieLogado })).status, 303);
    assert.equal((await pedir("/login", { dados: { email: usuario.email, senha: "SenhaAntiga1!" } })).status, 401);
    assert.equal((await pedir("/login", { dados: { email: usuario.email, senha: nova.senha } })).status, 303);
    const login = await pedir("/login", { cookie: resposta.cookie }); assert.match(login.texto, /Senha redefinida!/);
    assert.doesNotMatch(login.texto, /recovery-form/);
  });
  await t.test("replay em nova sessão não reutiliza código", async () => {
    const inicio = await pedir("/recuperar-senha");
    cookie = inicio.cookie; csrf = inicio.texto.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
    const resposta = await pedir("/resetar-senha", { cookie, dados: { ...nova, codigo: codigoEnviado, _csrf: csrf } });
    assert.equal(resposta.status, 422); assert.match(resposta.texto, /Código inválido, expirado/);
  });
  await t.test("SMTP falhando não revela conta nem torna a solicitação um falso erro 500", async () => {
    registro = null; falharEmail = true;
    const resposta = await pedir("/recuperar-senha", { cookie, dados: { email: usuario.email, _csrf: csrf } });
    assert.equal(resposta.status, 200); assert.doesNotMatch(resposta.texto, /smtp-segredo/);
    assert.match(resposta.texto, /Se esse e-mail pertencer/);
    assert.equal((await pedir("/new-report", { cookie })).status, 303);
  });
  await t.test("banco falhando não expõe SQL ou códigos", async () => {
    falharBanco = true;
    const resposta = await pedir("/recuperar-senha", { cookie, dados: { email: usuario.email, _csrf: csrf } });
    assert.equal(resposta.status, 500); assert.equal(resposta.texto, "Erro interno do servidor");
  });
});
