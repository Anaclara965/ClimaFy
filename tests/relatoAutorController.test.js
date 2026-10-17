const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const usuarios = require("../app/models/usuarioModel");
const consulta = require("../app/models/relatoConsultaModel");
const autor = require("../app/models/relatoAutorModel");
const { assinaturaSenha } = require("../app/middlewares/exigirAutenticacao");
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("edição/exclusão usam rotas e telas existentes, sessão, CSRF e somente campos validados", async t => {
  let indisponivel = false, falha, ativo = true;
  const leituras = [], edicoes = [], exclusoes = [];
  const relato = { publicId: id, versao: "1", titulo: 'Título " <script>alert(1)</script>', descricao: "Original",
    severidade: "grave", categoriaSlug: "alagamento", categoria: "Alagamento", bairroId: 85,
    bairro: "Consolação", cidade: "São Paulo", latitude: -23.55, longitude: -46.63, referencia: null,
    criadoEm: new Date().toISOString(), votos: 2, status: "aberto", moderacao: "aprovado" };
  t.mock.method(usuarios, "buscarPorId", async () => ({ id: 7, nome: "Teste", papel: "cidadao", status: ativo ? "ativo" : "bloqueado",
    email_verificado_em: new Date(), senha_hash: "hash" }));
  t.mock.method(consulta, "buscarPrivado", async (uuid, filtro) => {
    leituras.push({ uuid, filtro }); return indisponivel ? null : { ...relato };
  });
  t.mock.method(autor, "editar", async dados => {
    if (falha) throw falha;
    edicoes.push(dados); return { publicId: id, versao: "2", status: "aberto", alterado: true, publicado: false };
  });
  t.mock.method(autor, "excluir", async dados => {
    if (falha) throw falha;
    exclusoes.push(dados); return { publicId: id, excluido: true };
  });
  const app = express(); app.use(express.json());
  app.use(session({ secret: "somente-teste-autor", resave: false, saveUninitialized: false }));
  app.set("view engine", "ejs"); app.set("views", path.join(__dirname, "../app/views"));
  app.use((req, res, next) => { res.locals.usuario = req.session.usuario ?? null; next(); });
  app.post("/teste/login", (req, res) => {
    req.session.usuario = { id: 7 }; req.session.assinaturaSenha = assinaturaSenha({ senha_hash: "hash" }); res.json({ ok: true });
  });
  app.use(require("../app/routes/router"));
  app.use((erro, req, res, next) => res.status(500).json({ erro: "Erro interno do servidor" }));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening"); const origem = `http://127.0.0.1:${servidor.address().port}`;
  let cookie, token;
  async function pedir(url, { method = "GET", body, sessao = true, csrf = token, tipo = "application/json" } = {}) {
    const res = await fetch(origem + url, { method, redirect: "manual", headers: {
      ...(sessao && cookie ? { Cookie: cookie } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(body !== undefined ? { "Content-Type": tipo } : {}),
    }, ...(body !== undefined ? { body: tipo === "application/json" ? JSON.stringify(body) : body } : {}) });
    const texto = await res.text();
    return { status: res.status, texto, cookie: res.headers.get("set-cookie")?.split(";")[0], cache: res.headers.get("cache-control") };
  }
  const dados = { titulo: " Título corrigido ", descricao: " Descrição corrigida ", categoria: "alagamento", severidade: "GRAVE",
    bairro: "85", latitude: "-23.55", longitude: "-46.63", referencia: " Perto da estação ", versao: "1" };

  await t.test("visitante não lê edição, não edita e não exclui", async () => {
    assert.equal((await pedir(`/meus-relatos/${id}/editar`)).status, 303);
    assert.equal((await pedir(`/api/meus-relatos/${id}`)).status, 401);
    for (const method of ["PUT", "DELETE"]) assert.equal((await pedir(`/api/meus-relatos/${id}`, { method, body: dados })).status, 401);
    assert.equal(leituras.length, 0); assert.equal(edicoes.length, 0); assert.equal(exclusoes.length, 0);
  });
  cookie = (await pedir("/teste/login", { method: "POST" })).cookie;
  await t.test("detalhe próprio oferece editar/excluir e API fornece versão/token", async () => {
    const api = await pedir(`/api/meus-relatos/${id}?usuarioId=999`); assert.equal(api.status, 200);
    const corpo = JSON.parse(api.texto); token = corpo.csrfToken;
    assert.match(token, /^[a-f0-9]{64}$/); assert.equal(corpo.relato.versao, "1");
    assert.deepEqual(leituras.at(-1).filtro, { autorId: 7, moderador: false });
    const detalhe = await pedir(`/meus-relatos/${id}`);
    assert.match(detalhe.texto, new RegExp(`/meus-relatos/${id}/editar`));
    assert.match(detalhe.texto, /id="delete-report"/); assert.equal(detalhe.cache, "no-store");
  });
  await t.test("edição reaproveita new-report.ejs e escapa JSON inicial sem injeção de HTML", async () => {
    const pagina = await pedir(`/meus-relatos/${id}/editar`);
    assert.equal(pagina.status, 200); assert.equal(pagina.cache, "no-store");
    assert.match(pagina.texto, /Editar meu relato/); assert.match(pagina.texto, /id="new-report-form"/);
    assert.match(pagina.texto, /data-inicial="\{&#34;/); assert.doesNotMatch(pagina.texto, /<script>alert\(1\)<\/script>/);
    assert.match(pagina.texto, /&lt;script&gt;/); assert.match(pagina.texto, /Salvar alterações para revisão/);
    assert.deepEqual(leituras.at(-1), { uuid: id, filtro: { autorId: 7 } });
    assert.equal((await pedir("/new-report")).status, 200);
  });
  await t.test("UUID inválido e relato de terceiro/excluído não expõem formulário", async () => {
    const antes = leituras.length;
    assert.equal((await pedir("/meus-relatos/invalido/editar")).status, 404); assert.equal(leituras.length, antes);
    indisponivel = true; assert.equal((await pedir(`/meus-relatos/${id}/editar`)).status, 404); indisponivel = false;
  });
  await t.test("CSRF obrigatório nos dois métodos e formulário tradicional não é aceito", async () => {
    for (const method of ["PUT", "DELETE"]) {
      assert.equal((await pedir(`/api/meus-relatos/${id}`, { method, body: dados, csrf: null })).status, 403);
      assert.equal((await pedir(`/api/meus-relatos/${id}`, { method, body: "", tipo: "application/x-www-form-urlencoded" })).status, 415);
    }
  });
  await t.test("versão e campos inválidos não chegam aos models", async () => {
    for (const versao of [undefined, 1, "0", "01", "4294967296", [], {}]) {
      for (const method of ["PUT", "DELETE"]) assert.equal((await pedir(`/api/meus-relatos/${id}`, {
        method, body: { ...dados, versao },
      })).status, 422);
    }
    for (const invalido of [{ titulo: "" }, { descricao: "a".repeat(281) }, { latitude: "91" }, { categoria: [] }, { bairro: 0 }]) {
      assert.equal((await pedir(`/api/meus-relatos/${id}`, { method: "PUT", body: { ...dados, ...invalido } })).status, 422);
    }
    assert.equal(edicoes.length, 0); assert.equal(exclusoes.length, 0);
  });
  await t.test("edição normaliza campos e ignora autor, status, cidade e aprovação falsos", async () => {
    const resposta = await pedir(`/api/meus-relatos/${id}`, { method: "PUT", body: { ...dados, usuarioId: 999,
      status: "resolvido", cidade: 999, publicado: true, versao_conteudo: 100 } });
    assert.equal(resposta.status, 200); assert.equal(JSON.parse(resposta.texto).publicado, false);
    assert.deepEqual(edicoes.at(-1), { publicId: id, usuarioId: 7, versao: "1", titulo: "Título corrigido", descricao: "Descrição corrigida",
      categoriaSlug: "alagamento", gravidade: "grave", bairroId: 85, latitude: -23.55, longitude: -46.63, referencia: "Perto da estação" });
  });
  await t.test("exclusão usa somente autor da sessão, UUID e versão", async () => {
    assert.equal((await pedir(`/api/meus-relatos/${id}`, { method: "DELETE", body: { versao: "1", usuarioId: 999 } })).status, 200);
    assert.deepEqual(exclusoes.at(-1), { publicId: id, usuarioId: 7, versao: "1" });
  });
  await t.test("404/409 previstos são preservados; 500 não expõe SQL", async () => {
    for (const status of [404, 409]) {
      falha = Object.assign(new Error("Ação recusada"), { status, previsto: true });
      assert.equal((await pedir(`/api/meus-relatos/${id}`, { method: "PUT", body: dados })).status, status);
      assert.equal((await pedir(`/api/meus-relatos/${id}`, { method: "DELETE", body: dados })).status, status);
    }
    falha = new Error("SQL que não pode ser exposto");
    assert.deepEqual(JSON.parse((await pedir(`/api/meus-relatos/${id}`, { method: "PUT", body: dados })).texto), { erro: "Erro interno do servidor" });
    falha = null;
  });
  await t.test("bloqueio de conta revoga edição antes do model", async () => {
    ativo = false; const antes = edicoes.length;
    assert.equal((await pedir(`/api/meus-relatos/${id}`, { method: "PUT", body: dados })).status, 401);
    assert.equal(edicoes.length, antes);
  });
});
