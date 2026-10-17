const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const usuarioModel = require("../app/models/usuarioModel");
const consulta = require("../app/models/relatoConsultaModel");
const moderacao = require("../app/models/moderacaoModel");

test("rotas de consulta e moderacao com sessoes reais e banco simulado", async t => {
  let papel = "cidadao", falha;
  const consultas = [], alteracoes = [];
  t.mock.method(usuarioModel, "buscarPorId", async id => ({ id, nome: "Teste", papel, status: "ativo", email_verificado_em: new Date() }));
  t.mock.method(consulta, "listar", async filtros => { consultas.push(filtros); return { relatos: [], paginacao: { total: 0 } }; });
  t.mock.method(consulta, "buscarPublico", async () => null);
  t.mock.method(moderacao, "listar", async () => ({ relatos: [], motivos: [], resumo: {} }));
  t.mock.method(moderacao, "alterar", async dados => {
    if (falha) throw falha; alteracoes.push(dados); return { ok: true };
  });
  const app = express(); app.use(express.json());
  app.use(session({ secret: "teste-moderacao-relatos", resave: false, saveUninitialized: false }));
  app.post("/teste/login", (req, res) => {
    req.session.usuario = { id: 7 };
    req.session.assinaturaSenha = require("../app/middlewares/exigirAutenticacao").assinaturaSenha({});
    res.json({ ok: true });
  });
  app.use(require("../app/routes/router")); app.use(require("../app/routes/router-adm"));
  app.use((erro, req, res, next) => res.status(500).json({ erro: "Erro interno do servidor" }));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening"); const url = "http://127.0.0.1:" + servidor.address().port;
  const login = await fetch(url + "/teste/login", { method: "POST" }); await login.text();
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let token;
  async function pedir(path, { sessao = true, method = "GET", body, csrf = token } = {}) {
    const resposta = await fetch(url + path, { method, headers: {
      ...(sessao ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: resposta.status, corpo: await resposta.json() };
  }
  await t.test("publico pode listar sem sessao; invalidos nao chegam ao SQL", async () => {
    assert.equal((await pedir("/api/relatos", { sessao: false })).status, 200);
    for (const query of ["pagina=0", "limite=999", "bairro=1&bairro=2", "status=rejeitado", "ordem=SQL", "dias=999"]) {
      const antes = consultas.length; assert.equal((await pedir("/api/relatos?" + query)).status, 400, query);
      assert.equal(consultas.length, antes);
    }
    assert.equal((await pedir("/api/relatos/" + id)).status, 404);
  });
  await t.test("meus relatos exige login e usa autor da sessao", async () => {
    assert.equal((await pedir("/api/meus-relatos", { sessao: false })).status, 401);
    assert.equal((await pedir("/api/meus-relatos?autorId=999")).status, 200);
    assert.equal(consultas.at(-1).autorId, 7);
  });
  await t.test("visitante e cidadao nao moderam nem leem fila", async () => {
    assert.equal((await pedir("/api/adm/relatos", { sessao: false })).status, 401);
    assert.equal((await pedir("/api/adm/relatos")).status, 403);
    assert.equal((await pedir("/api/adm/relatos/" + id + "/moderacao", { method: "POST", body: { decisao: "aprovado", revisao: "0" } })).status, 403);
    assert.equal(alteracoes.length, 0);
  });
  await t.test("moderador recebe token e sem token acao e recusada", async () => {
    papel = "moderador";
    const fila = await pedir("/api/adm/relatos"); token = fila.corpo.csrfToken;
    assert.match(token, /^[a-f0-9]{64}$/);
    for (const csrf of [null, "a".repeat(64), "é".repeat(64)]) {
      assert.equal((await pedir("/api/adm/relatos/" + id + "/moderacao", { csrf, method: "POST", body: { decisao: "aprovado", revisao: "0" } })).status, 403);
    }
  });
  await t.test("decisao valida usa identidade real e ignora status/autor falsos", async () => {
    const res = await pedir("/api/adm/relatos/" + id + "/moderacao", { method: "POST",
      body: { decisao: "aprovado", revisao: "0", versao: "1", moderadorId: 999, status: "resolvido" } });
    assert.equal(res.status, 200); assert.equal(alteracoes.at(-1).moderadorId, 7);
    assert.equal(alteracoes.at(-1).situacao, undefined);
    for (const body of [{ decisao: "invalida", revisao: "0" }, { decisao: "aprovado" },
      { decisao: "rejeitado", revisao: "0" }, { decisao: "aprovado", revisao: "0", observacao: {} }]) {
      const antes = alteracoes.length;
      assert.ok((await pedir("/api/adm/relatos/" + id + "/moderacao", { method: "POST", body: { versao: "1", ...body } })).status >= 400);
      assert.equal(alteracoes.length, antes);
    }
  });
  await t.test("situacao e moderacao sao endpoints independentes", async () => {
    const res = await pedir("/api/adm/relatos/" + id + "/situacao", { method: "PATCH",
      body: { status: "resolvido", statusAnterior: "aberto", versao: "1" } });
    assert.equal(res.status, 200); assert.equal(alteracoes.at(-1).situacao, "resolvido");
    assert.equal(alteracoes.at(-1).decisao, undefined);
  });
  await t.test("conflito preserva 409 e falha inesperada nao expoe SQL", async () => {
    falha = Object.assign(new Error("Revisão mudou."), { status: 409, previsto: true });
    const opcoes = { method: "POST", body: { decisao: "aprovado", revisao: "0", versao: "1" } };
    assert.equal((await pedir("/api/adm/relatos/" + id + "/moderacao", opcoes)).status, 409);
    falha = new Error("SQL secreto");
    const res = await pedir("/api/adm/relatos/" + id + "/moderacao", opcoes);
    assert.equal(res.status, 500); assert.equal(res.corpo.erro.includes("SQL"), false);
  });
});
