const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { tratarErroJson } = require("../app/middlewares/tratarErroJson");

test("app real distingue JSON malformado de erro interno, sem banco real", async t => {
  t.mock.method(require("dotenv"), "config", () => ({}));
  t.mock.method(console, "warn", () => {});
  const logs = [];
  t.mock.method(console, "error", (...dados) => logs.push(dados));
  const consulta = require("../app/models/relatoConsultaModel");
  t.mock.method(consulta, "listar", async () => { throw new SyntaxError("falha de logica simulada"); });
  const app = require("../app");
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening");
  const origem = "http://127.0.0.1:" + servidor.address().port;
  for (const corpo of ['{"senha":"segredo-ficticio",', '{invalido', 'null']) {
    const resposta = await fetch(origem + "/api/relatos", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo });
    assert.equal(resposta.status, 400);
    const json = await resposta.json(); assert.match(json.erro, /JSON inválido/);
    assert.equal(JSON.stringify(json).includes("segredo-ficticio"), false);
  }
  assert.equal(logs.length, 0, "parser nao deve despejar request.body nos logs");
  const pagina = await fetch(origem + "/cadastro-dados-pessoais", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{invalido" });
  assert.equal(pagina.status, 400); assert.match(pagina.headers.get("content-type"), /text\/html/);
  assert.match(await pagina.text(), /Dados inválidos/);
  const valido = await fetch(origem + "/api/relatos", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(valido.status, 401, "JSON valido continua ate a autenticacao");
  const interno = await fetch(origem + "/api/relatos");
  assert.equal(interno.status, 500); assert.deepEqual(await interno.json(), { erro: "Erro interno do servidor" });
  assert.equal(logs.length, 1);
});
test("middleware nao classifica SyntaxError de negocio como JSON malformado", () => {
  const falha = new SyntaxError("regra de negocio"); let recebido;
  tratarErroJson(falha, {}, {}, erro => { recebido = erro; });
  assert.equal(recebido, falha);
});
