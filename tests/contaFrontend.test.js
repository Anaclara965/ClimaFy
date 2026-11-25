const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const usuarioModel = require("../app/models/usuarioModel");
const verificacaoModel = require("../app/models/verificacaoModel");
const emailService = require("../app/services/emailService");
const midiaService = require("../app/services/midiaService");
const { assinaturaSenha } = require("../app/middlewares/exigirAutenticacao");

test("perfil e alteração de senha usam campos existentes e exigem autenticação/CSRF", async t => {
  const usuario = {
    id: 8, public_id: "perfil-teste", nome: "Ana", sobrenome: "Silva",
    email: "ana@example.com", papel: "cidadao", status: "ativo",
    email_verificado_em: new Date(), senha_hash: await bcrypt.hash("SenhaAntiga1!", 4),
    telefone: null, email_pendente: null,
  };
  const png = Buffer.from("89504e470d0a1a0a0000000d494844520000000100000001", "hex");
  const fotoPerfil = {
    tipo: "foto", chave_arquivo: "climafy/perfis/12345678-1234-4234-8234-123456789abc",
    mime_type: "image/png", tamanho_bytes: png.length,
  };
  let atualizacoesPerfil = 0, atualizacoesSenha = 0, codigoEmailEnviado;
  t.mock.method(usuarioModel, "buscarPerfilPorId", async id => {
    if (id !== usuario.id) return null;
    const { papel, ...perfil } = usuario;
    return perfil;
  });
  t.mock.method(usuarioModel, "buscarPorId", async id => id === usuario.id ? { ...usuario } : null);
  t.mock.method(usuarioModel, "atualizarPerfil", async (id, dados) => {
    assert.equal(id, usuario.id);
    usuario.nome = dados.nome;
    usuario.sobrenome = dados.sobrenome;
    usuario.telefone = dados.telefone;
    atualizacoesPerfil++;
  });
  t.mock.method(usuarioModel, "atualizarFotoPerfil", async (id, foto) => {
    assert.equal(id, usuario.id);
    usuario.foto_perfil_chave = foto.chave_arquivo;
    usuario.foto_perfil_mime_type = foto.mime_type;
    usuario.foto_perfil_tamanho_bytes = foto.tamanho_bytes;
    return { foto_perfil_chave: null, foto_perfil_mime_type: null, foto_perfil_tamanho_bytes: null };
  });
  t.mock.method(usuarioModel, "atualizarSenha", async (id, hash) => {
    assert.equal(id, usuario.id);
    usuario.senha_hash = hash;
    atualizacoesSenha++;
  });
  t.mock.method(verificacaoModel, "solicitarAlteracaoEmail", async ({ usuarioId, email }) => {
    assert.equal(usuarioId, usuario.id);
    usuario.email_pendente = email;
    return { ok: true, email };
  });
  t.mock.method(verificacaoModel, "confirmarAlteracaoEmail", async ({ codigo }) => {
    if (codigo !== codigoEmailEnviado) return { ok: false, motivo: "incorreto", restantes: 4 };
    usuario.email = usuario.email_pendente;
    usuario.email_pendente = null;
    return { ok: true, email: usuario.email };
  });
  t.mock.method(emailService, "enviarCodigoVerificacao", async (email, codigo, opcoes) => {
    assert.equal(email, "nova@example.com");
    assert.equal(opcoes.finalidade, "alteracao_email");
    codigoEmailEnviado = codigo;
    return { enviado: true };
  });
  t.mock.method(midiaService, "disponivel", () => true);
  t.mock.method(midiaService, "salvarPerfil", async () => fotoPerfil);
  t.mock.method(midiaService, "removerPerfil", async () => {});
  t.mock.method(midiaService, "lerPerfil", async () => png);

  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(session({ name: "climafy.sid", secret: "teste-perfil-climafy", resave: false, saveUninitialized: false }));
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "../app/views"));
  app.get("/teste-login", (req, res) => {
    req.session.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel };
    req.session.assinaturaSenha = assinaturaSenha(usuario);
    res.sendStatus(204);
  });
  app.use((req, res, next) => { res.locals.usuario = req.session.usuario ?? null; next(); });
  app.use(require("../app/routes/router"));
  app.use((erro, req, res, next) => res.status(500).send("Erro interno"));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening");
  const origem = `http://127.0.0.1:${servidor.address().port}`;

  async function pedir(rota, { cookie, dados, multipart = false } = {}) {
    const resposta = await fetch(origem + rota, {
      redirect: "manual",
      method: dados ? "POST" : "GET",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(dados && !multipart ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(dados ? { body: multipart ? dados : new URLSearchParams(dados) } : {}),
    });
    return {
      status: resposta.status,
      texto: await resposta.text(),
      destino: resposta.headers.get("location"),
      cookie: resposta.headers.get("set-cookie")?.split(";")[0],
      cache: resposta.headers.get("cache-control"),
    };
  }

  assert.equal((await pedir("/alterar-perfil")).destino, "/login?proximo=%2Falterar-perfil");
  let login = await pedir("/teste-login");
  const cookie = login.cookie;
  const perfil = await pedir("/alterar-perfil", { cookie });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.cache, "no-store");
  assert.match(perfil.texto, /Ana/);
  assert.match(perfil.texto, /name="emailNovo"/);
  assert.match(perfil.texto, /\/alterar-senha/);
  const csrf = perfil.texto.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];

  usuario.papel = "administrador";
  const perfilAdmin = await pedir("/alterar-perfil", { cookie });
  assert.match(perfilAdmin.texto, /Moderação/);
  assert.doesNotMatch(perfilAdmin.texto, /Relatar|Meus relatos|Registrar um\s+Evento/);
  usuario.papel = "cidadao";

  assert.equal((await pedir("/alterar-perfil", {
    cookie, dados: { _csrf: csrf, nome: "A", sobrenome: "Silva", telefone: "" },
  })).status, 422);
  assert.equal(atualizacoesPerfil, 0);
  const salvo = await pedir("/alterar-perfil", {
    cookie, dados: { _csrf: csrf, nome: "Beatriz", sobrenome: "Costa", telefone: "+55 (11) 99999-9999" },
  });
  assert.equal(salvo.status, 303);
  assert.equal(salvo.destino, "/alterar-perfil");
  assert.equal(atualizacoesPerfil, 1);
  assert.equal((await pedir("/alterar-perfil", { cookie })).texto.includes("Beatriz"), true);
  assert.equal(usuario.telefone, "+5511999999999");

  const emailPedido = await pedir("/alterar-email", {
    cookie, dados: { _csrf: csrf, emailNovo: "NOVA@example.com" },
  });
  assert.equal(emailPedido.status, 303);
  assert.equal(usuario.email, "ana@example.com");
  assert.equal(usuario.email_pendente, "nova@example.com");
  assert.match((await pedir("/alterar-perfil", { cookie })).texto, /Confirmação pendente/);
  const emailConfirmado = await pedir("/confirmar-email", {
    cookie, dados: { _csrf: csrf, codigoEmail: codigoEmailEnviado },
  });
  assert.equal(emailConfirmado.status, 303);
  assert.equal(usuario.email, "nova@example.com");
  assert.equal(usuario.email_pendente, null);

  const fotoForm = new FormData();
  fotoForm.set("_csrf", csrf);
  fotoForm.set("foto", new Blob([png], { type: "image/png" }), "avatar.png");
  const fotoSalva = await pedir("/alterar-perfil/foto", { cookie, dados: fotoForm, multipart: true });
  assert.equal(fotoSalva.status, 303);
  assert.equal(usuario.foto_perfil_chave, fotoPerfil.chave_arquivo);
  const perfilComFoto = await pedir("/alterar-perfil", { cookie });
  assert.match(perfilComFoto.texto, /class="header-profile-avatar" src="\/api\/conta\/foto"/);
  assert.match(perfilComFoto.texto, /class="profile-avatar" src="\/api\/conta\/foto"/);
  const novaSessao = await pedir("/teste-login");
  const perfilAposLogin = await pedir("/alterar-perfil", { cookie: novaSessao.cookie });
  assert.match(perfilAposLogin.texto, /class="header-profile-avatar" src="\/api\/conta\/foto"/);
  const foto = await pedir("/api/conta/foto", { cookie });
  assert.equal(foto.status, 200);
  assert.match(foto.texto, /IHDR/);
  assert.equal((await pedir("/api/conta/foto")).status, 401);

  const senhaPage = await pedir("/alterar-senha", { cookie });
  assert.equal(senhaPage.status, 200);
  const csrfSenha = senhaPage.texto.match(/name="_csrf" value="([a-f0-9]{64})"/)[1];
  assert.equal((await pedir("/alterar-senha", {
    cookie, dados: { _csrf: csrfSenha, senhaAtual: "errada", novaSenha: "NovaSenha2!", confirmaNovaSenha: "NovaSenha2!" },
  })).status, 422);
  assert.equal(atualizacoesSenha, 0);

  for (const dadosSenha of [
    { novaSenha: "senha-fraca", confirmaNovaSenha: "senha-fraca" },
    { novaSenha: "NovaSenha2!", confirmaNovaSenha: "OutraSenha2!" },
    { novaSenha: "Aa1!" + "x".repeat(69), confirmaNovaSenha: "Aa1!" + "x".repeat(69) },
  ]) {
    const resposta = await pedir("/alterar-senha", {
      cookie, dados: { _csrf: csrfSenha, senhaAtual: "SenhaAntiga1!", ...dadosSenha },
    });
    assert.equal(resposta.status, 422);
  }
  assert.equal(atualizacoesSenha, 0);

  const alterada = await pedir("/alterar-senha", {
    cookie, dados: { _csrf: csrfSenha, senhaAtual: "SenhaAntiga1!", novaSenha: "NovaSenha2!", confirmaNovaSenha: "NovaSenha2!" },
  });
  assert.equal(alterada.status, 303);
  assert.equal(alterada.destino, "/alterar-senha");
  assert.equal(atualizacoesSenha, 1);
  assert.equal(await bcrypt.compare("NovaSenha2!", usuario.senha_hash), true);
  assert.equal((await pedir("/alterar-perfil", { cookie })).status, 200);
});
