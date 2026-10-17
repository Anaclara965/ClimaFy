const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const { criarGeocodificacaoService, resumirLocal } = require("../app/services/geocodificacaoService");
const { criarBairroModel } = require("../app/models/bairroModel");
const { criarPoolFalso } = require("./support/fakePool");
const geocodificacao = require("../app/services/geocodificacaoService");
const bairroModel = require("../app/models/bairroModel");
const usuarioModel = require("../app/models/usuarioModel");

const feature = {
  geometry: { type: "Point", coordinates: [-46.63, -23.55] },
  properties: { name: "Praça", locality: "Glicério", district: "Sé", city: "São Paulo", state: "São Paulo", countrycode: "BR" },
};

test("geocodificacao respeita ordem GeoJSON e separa cidade, UF e bairros", () => {
  assert.deepEqual(resumirLocal(feature), {
    longitude: -46.63, latitude: -23.55,
    endereco: "Praça — Glicério — São Paulo", cidade: "São Paulo", uf: "SP",
    pais: "BR", bairros: ["Glicério", "Sé"],
  });
  assert.equal(resumirLocal({ properties: {} }), null);
  assert.equal(resumirLocal({ ...feature, geometry: { type: "Point", coordinates: [181, 20] } }), null);
});

test("geocoder codifica endereco, filtra pais e reutiliza cache", async () => {
  const consultas = [];
  const servico = criarGeocodificacaoService({ intervaloMs: 0, requisitar: async (url) => {
    consultas.push(url);
    return { ok: true, json: async () => ({ features: [feature,
      { ...feature, properties: { ...feature.properties, countrycode: "PT" } }] }) };
  } });
  const termo = "Rua A & B, São Paulo";
  const [a, b] = await Promise.all([servico.buscarEnderecos(termo), servico.buscarEnderecos(termo)]);
  assert.equal(a.length, 1);
  assert.deepEqual(a, b);
  assert.equal(consultas.length, 1);
  assert.equal(consultas[0].searchParams.get("q"), termo);
  assert.equal(consultas[0].searchParams.get("countrycode"), "BR");
  await servico.buscarEnderecos(termo);
  assert.equal(consultas.length, 1);
  await servico.identificarPonto(-23.55, -46.63);
  assert.equal(consultas[1].pathname, "/reverse");
  assert.equal(consultas[1].searchParams.get("lat"), "-23.55");
  assert.equal(consultas[1].searchParams.get("radius"), "1");
});

test("falha e timeout do provedor viram 503 inclusive em pedidos simultaneos", async () => {
  const servico = criarGeocodificacaoService({ intervaloMs: 0,
    requisitar: async () => { throw new Error("URL ou dados internos"); } });
  const resultados = await Promise.allSettled([
    servico.buscarEnderecos("Rua de teste"), servico.buscarEnderecos("Rua de teste"),
  ]);
  for (const resultado of resultados) {
    assert.equal(resultado.reason.status, 503);
    assert.equal(resultado.reason.message.includes("internos"), false);
  }
  const invalido = criarGeocodificacaoService({ intervaloMs: 0,
    requisitar: async () => ({ ok: true, json: async () => ({ erro: "resposta malformada" }) }) });
  await assert.rejects(invalido.buscarEnderecos("Rua teste"), { status: 503 });
});

test("fila cheia recusa excesso em vez de sobrecarregar provedor", async () => {
  let liberar;
  const bloqueio = new Promise((resolve) => { liberar = resolve; });
  const servico = criarGeocodificacaoService({ intervaloMs: 0, requisitar: async () => {
    await bloqueio;
    return { ok: true, json: async () => ({ features: [] }) };
  } });
  const trabalhos = [0, 1, 2, 3].map((n) => servico.buscarEnderecos(`Rua ${n}`));
  try {
    await assert.rejects(servico.buscarEnderecos("Rua excedente"), { status: 429 });
  } finally { liberar(); }
  await Promise.all(trabalhos);
});

test("bairro automatico exige nome exato, cidade e UF e prefere localidade", async () => {
  const pool = criarPoolFalso({ resultados: [[
    { id: 1, nome: "Sé", nome_normalizado: "se", cidade: "São Paulo" },
    { id: 2, nome: "Glicério", nome_normalizado: "glicerio", cidade: "São Paulo" },
  ]] });
  const modelo = criarBairroModel(pool);
  const bairro = await modelo.buscarPorLocalizacao({ cidade: "São Paulo", uf: "SP", bairros: ["Glicério", "Sé"] });
  assert.equal(bairro.id, 2);
  assert.deepEqual(pool.chamadas[0].parametros, ["São Paulo", "SP", "glicerio", "se"]);
  assert.match(pool.chamadas[0].sql, /c\.ativo = 1/);
  assert.match(pool.chamadas[0].sql, /c\.uf = \?/);
});

test("bairro ausente, ambiguo ou sem cidade/UF nao recebe ID inventado", async () => {
  const pool = criarPoolFalso({ resultados: [[], [
    { id: 1, nome_normalizado: "centro" }, { id: 2, nome_normalizado: "centro" },
  ]] });
  const modelo = criarBairroModel(pool);
  assert.equal(await modelo.buscarPorLocalizacao({ cidade: "Outra", uf: "SP", bairros: ["Centro"] }), null);
  assert.equal(await modelo.buscarPorLocalizacao({ cidade: "Outra", uf: "SP", bairros: ["Centro"] }), null);
  assert.equal(await modelo.buscarPorLocalizacao({ cidade: "Outra", uf: "", bairros: ["Centro"] }), null);
  assert.equal(pool.chamadas.length, 2);
});

test("rotas de localizacao exigem sessao e validam antes de consultar", async (t) => {
  let consultas = 0;
  let falha = false;
  let local = resumirLocal(feature);
  let bairro = { id: 2, nome: "Glicério", cidade: "São Paulo" };
  let consultasBanco = 0;
  t.mock.method(usuarioModel, "buscarPorId", async () => ({ id: 7, status: "ativo", email_verificado_em: "2026-10-02" }));
  t.mock.method(geocodificacao, "buscarEnderecos", async () => { consultas++; return [local]; });
  t.mock.method(geocodificacao, "identificarPonto", async () => {
    consultas++;
    if (falha) throw Object.assign(new Error("Serviço indisponível"), { status: 503 });
    return local;
  });
  t.mock.method(bairroModel, "buscarPorLocalizacao", async () => { consultasBanco++; return bairro; });
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "localizacao-apenas-de-testes", resave: false, saveUninitialized: false }));
  app.post("/teste/sessao", (req, res) => {
    req.session.usuario = { id: 7 };
    req.session.assinaturaSenha = require("../app/middlewares/exigirAutenticacao").assinaturaSenha({});
    res.json({ ok: true });
  });
  app.use(require("../app/routes/router"));
  app.use((erro, req, res, next) => res.status(500).json({ erro: "Erro interno" }));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening");
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  const login = await fetch(origem + "/teste/sessao", { method: "POST" });
  await login.text();
  const cookie = login.headers.get("set-cookie").split(";")[0];
  async function pedir(url, dados, autenticado = true) {
    const res = await fetch(origem + url, { method: dados ? "POST" : "GET",
      headers: { ...(autenticado ? { Cookie: cookie } : {}), ...(dados ? { "Content-Type": "application/json" } : {}) },
      body: dados ? JSON.stringify(dados) : undefined });
    return { status: res.status, corpo: await res.json() };
  }
  const ponto = "/api/localizacao/ponto";
  const endereco = "/api/localizacao/endereco";
  assert.equal((await pedir(endereco + "?busca=Rua", undefined, false)).status, 401);
  assert.equal((await pedir(ponto, { latitude: 0, longitude: 0 }, false)).status, 401);
  for (const busca of ["", "a", "a".repeat(201)]) {
    assert.equal((await pedir(endereco + "?busca=" + busca)).status, 400);
  }
  for (const dados of [{}, { latitude: null, longitude: 0 }, { latitude: [], longitude: 0 },
    { latitude: " ", longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }]) {
    assert.equal((await pedir(ponto, dados)).status, 400);
  }
  assert.equal(consultas, 0);
  assert.equal((await pedir(endereco + "?busca=Rua%20Teste")).corpo.length, 1);
  assert.equal((await pedir(ponto, { latitude: 0, longitude: 0 })).corpo.bairro.id, 2);
  bairro = null;
  const desconhecido = await pedir(ponto, { latitude: -23.55, longitude: -46.63 });
  assert.equal(desconhecido.corpo.bairro, null);
  assert.equal(desconhecido.corpo.cidade, "São Paulo");
  const antes = consultasBanco;
  local = { ...local, pais: "PT" };
  assert.equal((await pedir(ponto, { latitude: 0, longitude: 0 })).corpo.bairro, null);
  assert.equal(consultasBanco, antes);
  falha = true;
  assert.equal((await pedir(ponto, { latitude: 0, longitude: 0 })).status, 503);
});
