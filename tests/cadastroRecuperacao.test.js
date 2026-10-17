const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const u = require("../app/models/usuarioModel");
const b = require("../app/models/bairroModel");
const v = require("../app/models/verificacaoModel");
const mail = require("../app/services/emailService");
const { compararCodigo } = require("../app/helpers/codigoVerificacao");

test("cadastro e retomada resistem a falha de SMTP, com modelos simulados", async t => {
  let usuario, codigo, codigoEnviado, falhar = true, naoConfirmado = false, cooldown = false, criacoes = 0;
  t.mock.method(console, "warn", () => {});
  t.mock.method(u, "emailJaExiste", async () => Boolean(usuario));
  t.mock.method(u, "criarUsuario", async dados => {
    criacoes++; usuario = { id: 7, ...dados, status: "ativo", papel: "cidadao", email_verificado_em: null, senha_hash: dados.senhaHash };
    return { ...usuario };
  });
  t.mock.method(u, "buscarPorEmail", async email => usuario?.email === email ? { ...usuario } : null);
  t.mock.method(b, "buscarPorId", async () => ({ id: 85, nome: "Consolação" }));
  t.mock.method(v, "criarCodigo", async dados => { codigo = { ...dados, expira_em: dados.expiraEm }; return 1; });
  t.mock.method(v, "buscarPendente", async () => codigo);
  t.mock.method(v, "contarEnviosRecentes", async () => cooldown ? 1 : 0);
  t.mock.method(v, "confirmarCadastro", async dados => {
    assert.equal(dados.usuarioId, 7); assert.equal(compararCodigo(dados.codigo, codigo.codigoHash), true);
    usuario.email_verificado_em = new Date(); return { ok: true };
  });
  t.mock.method(mail, "enviarCodigoVerificacao", async (email, valor) => {
    assert.equal(email, "pessoa@example.com"); codigoEnviado = valor;
    if (falhar) throw new Error("Falha SMTP simulada");
    return { enviado: !naoConfirmado };
  });
  const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: true }));
  app.use(session({ secret: "somente-teste-de-cadastro", resave: false, saveUninitialized: false }));
  app.set("view engine", "ejs"); app.set("views", path.join(__dirname, "../app/views"));
  app.use((req, res, next) => { res.locals.usuario = req.session?.usuario || null; next(); });
  app.get("/teste/estado", (req, res) => res.json({ pendente: req.session.cadastroPendente,
    autenticado: Boolean(req.session.usuario), bairroSugerido: req.session.bairroSugerido }));
  app.use(require("../app/routes/router"));
  app.use((erro, req, res, next) => res.status(500).json({ erro: "Erro interno do servidor" }));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening"); const origem = "http://127.0.0.1:" + servidor.address().port;
  async function pedir(rota, { cookie, dados, json = false, method = dados ? "POST" : "GET" } = {}) {
    const resposta = await fetch(origem + rota, { method, redirect: "manual", headers: {
      ...(cookie ? { Cookie: cookie } : {}), ...(dados ? { "Content-Type": json ? "application/json" : "application/x-www-form-urlencoded" } : {}),
    }, ...(dados ? { body: json ? JSON.stringify(dados) : new URLSearchParams(dados) } : {}) });
    return { status: resposta.status, destino: resposta.headers.get("location"), texto: await resposta.text(),
      cookie: resposta.headers.get("set-cookie")?.split(";")[0] };
  }
  const dados = { nome: "Pessoa", sobrenome: "Teste", email: "pessoa@example.com", senha: "TesteForte123!",
    "confirma-senha": "TesteForte123!", bairro: "85", termos: "aceito" };
  let cookie, cookieRetomada;
  await t.test("conta criada com SMTP falhando vai para verificacao, nao para erro 500", async () => {
    const resposta = await pedir("/cadastro-dados-pessoais", { dados }); cookie = resposta.cookie;
    assert.equal(resposta.status, 303); assert.equal(resposta.destino, "/cadastro-verificacao");
    assert.equal(criacoes, 1); assert.ok(cookie);
    const estado = JSON.parse((await pedir("/teste/estado", { cookie })).texto);
    assert.deepEqual(estado.pendente, { usuarioId: 7, email: dados.email });
    assert.equal(estado.autenticado, false); assert.equal(estado.bairroSugerido, 85);
    assert.equal((await pedir("/api/preferencias", { cookie, dados: {}, json: true })).status, 401);
  });
  await t.test("tela existente exibe aviso de falha sem dizer que enviou", async () => {
    const resposta = await pedir("/cadastro-verificacao", { cookie });
    assert.equal(resposta.status, 200); assert.match(resposta.texto, /Não conseguimos confirmar o envio/);
    assert.match(resposta.texto, /otp-feedback is-error/); assert.doesNotMatch(resposta.texto, /Enviamos um código/);
  });
  await t.test("reenviar sem sessao continua bloqueado e cooldown continua valendo", async () => {
    assert.equal((await pedir("/api/verificacao/reenviar", { method: "POST" })).status, 400);
    cooldown = true;
    assert.equal((await pedir("/api/verificacao/reenviar", { cookie, method: "POST" })).status, 429);
    cooldown = false;
  });
  await t.test("SMTP rejeitado ou sem confirmacao retorna 503 sem perder a etapa", async () => {
    const falha = await pedir("/api/verificacao/reenviar", { cookie, method: "POST" });
    assert.equal(falha.status, 503); assert.equal(JSON.parse(falha.texto).cooldown, 60);
    falhar = false; naoConfirmado = true;
    assert.equal((await pedir("/api/verificacao/reenviar", { cookie, method: "POST" })).status, 503);
    assert.ok(JSON.parse((await pedir("/teste/estado", { cookie })).texto).pendente);
    naoConfirmado = false;
  });
  await t.test("envio confirmado retorna 200 e validade do codigo gravado", async () => {
    const resposta = await pedir("/api/verificacao/reenviar", { cookie, method: "POST" });
    const corpo = JSON.parse(resposta.texto); assert.equal(resposta.status, 200); assert.equal(corpo.ok, true);
    assert.ok(corpo.segundosRestantes > 0 && corpo.segundosRestantes <= 300);
    assert.equal(corpo.cooldown, 60); assert.equal(criacoes, 1);
  });
  await t.test("senha incorreta nao cria etapa de verificacao nem reenvia email", async () => {
    const antes = codigo;
    const resposta = await pedir("/login", { dados: { email: dados.email, senha: "errada" } });
    assert.equal(resposta.status, 401); assert.equal(codigo, antes);
  });
  await t.test("login correto retoma a conta nao verificada mesmo com SMTP falhando", async () => {
    falhar = true;
    const resposta = await pedir("/login", { dados: { email: dados.email, senha: dados.senha } }); cookieRetomada = resposta.cookie;
    assert.equal(resposta.status, 303); assert.equal(resposta.destino, "/cadastro-verificacao");
    const estado = JSON.parse((await pedir("/teste/estado", { cookie: cookieRetomada })).texto);
    assert.equal(estado.pendente.usuarioId, 7); assert.equal(estado.autenticado, false);
    assert.match((await pedir("/cadastro-verificacao", { cookie: cookieRetomada })).texto, /Não conseguimos confirmar o envio/);
  });
  await t.test("retomada e reenvio nao duplicam conta; confirmacao mantem login separado", async () => {
    falhar = false;
    await pedir("/api/verificacao/reenviar", { cookie: cookieRetomada, method: "POST" });
    const resposta = await pedir("/api/verificacao", { cookie: cookieRetomada, dados: { codigo: codigoEnviado }, json: true });
    assert.equal(resposta.status, 200); assert.equal(JSON.parse(resposta.texto).ok, true);
    const estado = JSON.parse((await pedir("/teste/estado", { cookie: cookieRetomada })).texto);
    assert.equal(estado.pendente, undefined); assert.equal(estado.autenticado, false); assert.equal(criacoes, 1);
    assert.equal((await pedir("/cadastro-dados-pessoais", { dados })).status, 422);
    assert.equal(criacoes, 1);
  });
});
