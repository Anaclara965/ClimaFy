const test = require("node:test");
const assert = require("node:assert/strict");

const { criarBairroModel, escaparCuringa } = require("../app/models/bairroModel");
const { normalizar } = require("../app/helpers/normalizar");
const { criarPoolFalso } = require("./support/fakePool");

// Comportamento que existia no mock (busca sem acento) agora e garantido no SQL
// pelo mesmo normalizar() usado ao carregar a geografia.
test("normaliza acentos e caixa igual ao carregamento da geografia", () => {
  assert.equal(normalizar("Brás"), "bras");
  assert.equal(normalizar("VILA  MADALENA"), "vila madalena");
  assert.equal(normalizar("Freguesia do Ó/Brasilândia"), "freguesia do o brasilandia");
});

test("encontra Brás mesmo sem acento na busca", async () => {
  const pool = criarPoolFalso({
    resultados: [[{ id: 12, nome: "Brás", cidade: "São Paulo" }]],
  });
  const modelo = criarBairroModel(pool);

  const resultado = await modelo.buscarBairros("bras");

  assert.deepEqual(resultado, [{ id: 12, nome: "Brás", cidade: "São Paulo" }]);
  assert.equal(pool.chamadas[0].parametros[0], "%bras%");
});

test("a busca vazia devolve os bairros (LIKE %%) com o limite padrao", async () => {
  const pool = criarPoolFalso({ resultados: [[]] });
  const modelo = criarBairroModel(pool);

  const resultado = await modelo.buscarBairros("");

  assert.deepEqual(resultado, []);
  assert.equal(pool.chamadas[0].parametros[0], "%%");
  assert.equal(pool.chamadas[0].parametros[1], 20);
});

test("limita quantos bairros a consulta devolve", async () => {
  const pool = criarPoolFalso({ resultados: [[]] });
  const modelo = criarBairroModel(pool);

  await modelo.buscarBairros("vila", 500);

  assert.equal(pool.chamadas[0].parametros[1], 50);
});

test("caracteres curinga do LIKE sao escapados", () => {
  assert.equal(escaparCuringa("100%_x"), "100\\%\\_x");
});

test("buscarPorId devolve o bairro ou null", async () => {
  const pool = criarPoolFalso({
    resultados: [[{ id: 3, nome: "Vila Madalena", distrito_id: 7, cidade: "São Paulo" }], []],
  });
  const modelo = criarBairroModel(pool);

  const encontrado = await modelo.buscarPorId(3);
  const ausente = await modelo.buscarPorId(999);

  assert.equal(encontrado.nome, "Vila Madalena");
  assert.equal(ausente, null);
});
