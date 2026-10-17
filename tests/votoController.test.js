const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const votos = require("../app/models/votoModel");
const usuarios = require("../app/models/usuarioModel");
const { assinaturaSenha } = require("../app/middlewares/exigirAutenticacao");
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("API de votos usa sessão, autorização fresca, CSRF e contrato idempotente", async t => {
  let ativo = true, verificado = true, papel = "cidadao", senha_hash = "hash-teste", falha;
  let votado = false;
  const consultas = [], gravacoes = [];
  t.mock.method(usuarios, "buscarPorId", async () => ({ id: 7, papel, status: ativo ? "ativo" : "bloqueado",
    email_verificado_em: verificado ? new Date() : null, senha_hash }));
  t.mock.method(votos, "consultar", async dados => { consultas.push(dados); return [{ publicId: id, votos: Number(votado), votado, proprio: false, podeVotar: true }]; });
  t.mock.method(votos, "definir", async dados => {
    if (falha) throw falha;
    gravacoes.push(dados); votado = dados.votar;
    return { publicId: id, votos: Number(votado), votado, proprio: false, podeVotar: true };
  });
  const app = express(); app.use(express.json());
  app.use(session({ secret: "teste-voto-sem-acesso-ao-banco", resave: false, saveUninitialized: false }));
  // Login fictício somente no servidor de teste, nunca na aplicação real.
  app.post("/teste/sessao", (req, res) => {
    req.session.usuario = { id: 7 };
    req.session.assinaturaSenha = assinaturaSenha({ senha_hash }); res.json({ ok: true });
  });
  app.use(require("../app/routes/router"));
  app.use((erro, req, res, next) => res.status(500).json({ erro: "Erro interno do servidor" }));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening"); const origem = `http://127.0.0.1:${servidor.address().port}`;
  let cookie, token;
  async function pedir(url, { method = "GET", body, sessao = true, csrf = token, tipo = "application/json" } = {}) {
    const resposta = await fetch(origem + url, { method, headers: {
      ...(sessao && cookie ? { Cookie: cookie } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(body !== undefined ? { "Content-Type": tipo } : {}),
    }, ...(body !== undefined ? { body: tipo === "application/json" ? JSON.stringify(body) : body } : {}) });
    return { status: resposta.status, corpo: await resposta.json(), cache: resposta.headers.get("cache-control"),
      cookie: resposta.headers.get("set-cookie")?.split(";")[0] };
  }
  async function entrar() { cookie = (await pedir("/teste/sessao", { method: "POST" })).cookie; }

  await t.test("visitante não consulta estado privado nem altera votos", async () => {
    assert.equal((await pedir("/api/votos?relatos=" + id)).status, 401);
    for (const method of ["PUT", "DELETE"]) assert.equal((await pedir(`/api/relatos/${id}/voto`, { method, body: {} })).status, 401);
    assert.equal(consultas.length, 0); assert.equal(gravacoes.length, 0);
  });
  await entrar();
  await t.test("consulta em lote normaliza UUIDs, deduplica e entrega token só à sessão", async () => {
    const resposta = await pedir("/api/votos?relatos=" + id.toUpperCase() + "," + id);
    assert.equal(resposta.status, 200); assert.equal(resposta.cache, "no-store");
    token = resposta.corpo.csrfToken; assert.match(token, /^[a-f0-9]{64}$/);
    assert.deepEqual(consultas.at(-1), { usuarioId: 7, publicIds: [id] });
    assert.equal(resposta.corpo.votos[0].votado, false);
  });
  await t.test("parâmetros inválidos não chegam ao SQL", async () => {
    const antes = consultas.length;
    for (const query of ["", "?relatos=", "?relatos=invalido", `?relatos=${id}&relatos=${id}`,
      "?relatos=" + Array(51).fill(id).join(","), "?relatos=' OR 1=1--"]) {
      assert.equal((await pedir("/api/votos" + query)).status, 422, query);
    }
    assert.equal(consultas.length, antes);
  });
  await t.test("sem token, token errado/de outra sessão e formulário são recusados", async () => {
    for (const csrf of [null, "b".repeat(64)]) {
      assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: {}, csrf })).status, 403);
    }
    const outroCookie = (await pedir("/teste/sessao", { method: "POST", sessao: false })).cookie;
    const original = cookie; cookie = outroCookie;
    assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: {} })).status, 403);
    cookie = original;
    assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: "", tipo: "application/x-www-form-urlencoded" })).status, 415);
    assert.equal(gravacoes.length, 0);
  });
  await t.test("UUID e formato do corpo são verificados antes de gravar", async () => {
    assert.equal((await pedir("/api/relatos/errado/voto", { method: "PUT", body: {} })).status, 404);
    assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: [] })).status, 422);
    assert.equal(gravacoes.length, 0);
  });
  await t.test("PUT repetido mantém voto; DELETE repetido mantém ausência e ignora identidade enviada", async () => {
    for (const method of ["PUT", "PUT", "DELETE", "DELETE"]) {
      const resposta = await pedir(`/api/relatos/${id}/voto`, { method, body: { usuarioId: 999, votar: false, votos: 999 } });
      assert.equal(resposta.status, 200); assert.equal(resposta.cache, "no-store");
      assert.equal(resposta.corpo.voto.votado, method === "PUT"); assert.equal(resposta.corpo.voto.votos, method === "PUT" ? 1 : 0);
      assert.deepEqual(gravacoes.at(-1), { publicId: id, usuarioId: 7, votar: method === "PUT" });
    }
  });
  await t.test("regra de autoria/publicação preserva 403/404; erro interno não expõe SQL", async () => {
    for (const status of [403, 404]) {
      falha = Object.assign(new Error("Ação recusada"), { status, previsto: true });
      assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: {} })).status, status);
    }
    falha = new Error("SQL com detalhes privados");
    const resposta = await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: {} });
    assert.equal(resposta.status, 500); assert.deepEqual(resposta.corpo, { erro: "Erro interno do servidor" }); falha = null;
  });
  await t.test("moderador herda voto; papel desconhecido não recebe permissão", async () => {
    papel = "moderador"; assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: {} })).status, 200);
    papel = "desconhecido"; assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: {} })).status, 403);
    papel = "cidadao";
  });
  await t.test("bloqueio, e-mail não verificado e troca de senha revogam o acesso", async () => {
    const antes = gravacoes.length;
    ativo = false; assert.equal((await pedir(`/api/relatos/${id}/voto`, { method: "PUT", body: {} })).status, 401);
    ativo = true; await entrar(); verificado = false;
    assert.equal((await pedir("/api/votos?relatos=" + id)).status, 401);
    verificado = true; await entrar(); senha_hash = "hash-alterado";
    assert.equal((await pedir("/api/votos?relatos=" + id)).status, 401);
    assert.equal(gravacoes.length, antes);
  });
});
