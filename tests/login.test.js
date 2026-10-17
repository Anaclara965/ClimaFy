const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const usuarioModel = require("../app/models/usuarioModel");
const preferenciaModel = require("../app/models/preferenciaModel");

test("login e permissoes via HTTP com cookie real e banco simulado", async (t) => {
  // Nenhum .env e carregado e todos os acessos ao banco deste fluxo sao falsos.
  const usuario = {
    id: 1, public_id: "usuario-teste", nome: "Mariana", email: "mariana@example.com",
    status: "ativo", papel: "administrador", email_verificado_em: "2026-09-27",
    senha_hash: await bcrypt.hash("Clima2026!", 4),
  };
  let falharConsulta = false;
  let falharPreferencias = false;
  let acessos = 0;
  t.mock.method(usuarioModel, "buscarPorEmail", async (email) => email === usuario.email ? { ...usuario } : null);
  t.mock.method(usuarioModel, "buscarPorId", async (id) => {
    if (falharConsulta) throw new Error("Falha simulada de banco");
    assert.equal(id, usuario.id);
    return { ...usuario };
  });
  t.mock.method(usuarioModel, "registrarAcesso", async () => { acessos++; });
  t.mock.method(preferenciaModel, "temPreferencias", async () => {
    if (falharPreferencias) throw new Error("Falha simulada de preferencias");
    return false;
  });

  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: "segredo-apenas-do-servidor-local-de-testes",
    name: "climafy.sid", resave: false, saveUninitialized: false,
  }));
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "../app/views"));
  app.use((req, res, next) => {
    res.locals.usuario = req.session?.usuario ?? null;
    next();
  });
  // Existe apenas neste servidor de teste, nunca no app.js da aplicacao.
  app.post("/teste/iniciar-cadastro", (req, res) => {
    req.session.bairroSugerido = 3;
    req.session.cadastroPendente = { usuarioId: 1 };
    res.json({ ok: true });
  });
  app.use(require("../app/routes/router"));
  app.use(require("../app/routes/router-adm"));
  app.use((erro, req, res, next) => {
    res.status(500).json({ erro: "Falha simulada tratada" });
  });

  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    servidor.close((erro) => erro ? reject(erro) : resolve());
    servidor.closeAllConnections();
  }));
  await once(servidor, "listening");
  const origem = `http://127.0.0.1:${servidor.address().port}`;

  async function requisicao(url, { cookie, dados, metodo } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (dados) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const res = await fetch(origem + url, {
      method: metodo ?? (dados ? "POST" : "GET"),
      headers, body: dados ? new URLSearchParams(dados) : undefined,
      redirect: "manual",
    });
    const texto = await res.text();
    return {
      status: res.status, texto, destino: res.headers.get("location"),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  }

  const dadosLogin = { email: usuario.email, senha: "Clima2026!" };
  let cookieAnterior;
  let cookieLogado;

  await t.test("visitante nao acessa pagina privada nem API privada", async () => {
    assert.equal((await requisicao("/new-report")).status, 303);
    assert.equal((await requisicao("/api/preferencias", { metodo: "POST" })).status, 401);
  });

  await t.test("senha incorreta nao cria sessao autenticada", async () => {
    const res = await requisicao("/login", { dados: { ...dadosLogin, senha: "errada" } });
    assert.equal(res.status, 401);
    assert.equal(res.cookie, undefined);
    assert.equal(acessos, 0);
  });

  await t.test("login troca o cookie e invalida a sessao anterior", async () => {
    cookieAnterior = (await requisicao("/teste/iniciar-cadastro", { metodo: "POST" })).cookie;
    assert.ok(cookieAnterior);
    const res = await requisicao("/login", { cookie: cookieAnterior, dados: dadosLogin });
    assert.equal(res.status, 303);
    assert.equal(res.destino, "/cadastro-preferencias");
    cookieLogado = res.cookie;
    assert.ok(cookieLogado);
    assert.notEqual(cookieLogado, cookieAnterior);
    assert.equal((await requisicao("/new-report", { cookie: cookieAnterior })).status, 303);
    assert.equal((await requisicao("/new-report", { cookie: cookieLogado })).status, 200);
    assert.equal((await requisicao("/adm", { cookie: cookieLogado })).status, 200);
  });

  await t.test("mudanca de papel vale sem esperar logout ou novo login", async () => {
    usuario.papel = "cidadao";
    assert.equal((await requisicao("/adm", { cookie: cookieLogado })).status, 403);
    assert.equal((await requisicao("/new-report", { cookie: cookieLogado })).status, 200);
  });

  await t.test("falha de consulta nao permite usar permissoes antigas", async () => {
    falharConsulta = true;
    assert.equal((await requisicao("/new-report", { cookie: cookieLogado })).status, 500);
    falharConsulta = false;
  });

  await t.test("bloqueio revoga a sessao e impede novo login", async () => {
    usuario.status = "bloqueado";
    const res = await requisicao("/api/preferencias", { cookie: cookieLogado, metodo: "POST" });
    assert.equal(res.status, 401);
    assert.equal(res.cookie, "climafy.sid=");
    assert.equal((await requisicao("/new-report", { cookie: cookieLogado })).status, 303);
    assert.equal((await requisicao("/login", { dados: dadosLogin })).status, 403);
    usuario.status = "ativo";
  });

  await t.test("falha nas preferencias nao deixa um login parcialmente concluido", async () => {
    falharPreferencias = true;
    const res = await requisicao("/login", { dados: dadosLogin });
    assert.equal(res.status, 500);
    assert.equal(res.cookie, undefined);
    falharPreferencias = false;
  });

  await t.test("retorno externo e ignorado e logout apaga o cookie", async () => {
    const login = await requisicao("/login", { dados: { ...dadosLogin, proximo: "/\\example.com" } });
    assert.equal(login.destino, "/cadastro-preferencias");
    assert.ok(login.cookie);
    const logout = await requisicao("/logout", { cookie: login.cookie, metodo: "POST" });
    assert.equal(logout.status, 303);
    assert.equal(logout.destino, "/");
    assert.equal(logout.cookie, "climafy.sid=");
    assert.equal((await requisicao("/new-report", { cookie: login.cookie })).status, 303);
  });
});
