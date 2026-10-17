const test = require("node:test");
const assert = require("node:assert/strict");
const { criarRelatoModel } = require("../app/models/relatoModel");
const { criarPoolFalso } = require("./support/fakePool");

const dados = {
  usuarioId: 7, categoriaSlug: "alagamento", bairroId: 12,
  titulo: "Rua alagada", descricao: "A água está impedindo a passagem.",
  gravidade: "moderada", latitude: -23.55, longitude: -46.63, referencia: "Perto da praça",
};

function preparar(resultados) {
  const pool = criarPoolFalso({ resultados });
  return { pool, model: criarRelatoModel(pool) };
}

test("cria relato aberto com cidade do bairro e historico na mesma transacao", async () => {
  const { pool, model } = preparar([
    [{ id: 7 }], [{ id: 2 }], [{ id: 12, cidade_id: 1 }],
    { insertId: 50, affectedRows: 1 }, { affectedRows: 1 },
  ]);
  const resultado = await model.criarRelato({ ...dados, cidadeId: 999, status: "resolvido" });
  assert.equal(resultado.status, "aberto");
  assert.match(resultado.publicId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(pool.chamadas.map(({ sql }) => sql.split(/\s+/)[0]), [
    "BEGIN", "SELECT", "SELECT", "SELECT", "INSERT", "INSERT", "COMMIT", "RELEASE",
  ]);
  assert.ok(pool.chamadas.every(({ rotulo }) => rotulo === "conexao"));
  assert.match(pool.chamadas[1].sql, /email_verificado_em IS NOT NULL FOR UPDATE/);
  assert.deepEqual(pool.chamadas[2].parametros, ["alagamento"]);
  assert.match(pool.chamadas[3].sql, /b.ativo = 1 AND c.ativo = 1/);
  const insercao = pool.chamadas[4];
  assert.deepEqual(insercao.parametros, [
    resultado.publicId, 7, 2, 1, 12, dados.titulo, dados.descricao,
    "moderada", -23.55, -46.63, "Perto da praça",
  ]);
  assert.match(insercao.sql, /'aberto'/);
  assert.deepEqual(pool.chamadas[5].parametros, [50, 7]);
  assert.equal(pool.chamadas.some(({ sql }) => /INSERT INTO moderacoes_relato/.test(sql)), false);
});

for (const [nome, resultados, status, campo] of [
  ["conta inativa, excluida ou nao verificada", [[]], 403, "usuario"],
  ["categoria ausente ou inativa", [[{ id: 7 }], []], 422, "categoria"],
  ["bairro ausente ou inativo", [[{ id: 7 }], [{ id: 2 }], []], 422, "bairro"],
]) {
  test(`nao grava relato com ${nome}`, async () => {
    const { pool, model } = preparar(resultados);
    await assert.rejects(model.criarRelato(dados), (erro) => {
      assert.equal(erro.status, status);
      assert.equal(erro.campo, campo);
      return true;
    });
    assert.equal(pool.chamadas.some(({ sql }) => sql.startsWith("INSERT")), false);
    assert.deepEqual(pool.chamadas.slice(-2).map(({ sql }) => sql), ["ROLLBACK", "RELEASE"]);
  });
}

test("coordenadas ausentes ou invalidas nao sao substituidas por pontos ficticios", async () => {
  const { pool, model } = preparar([]);
  for (const ponto of [
    { latitude: undefined }, { latitude: null }, { latitude: "" },
    { latitude: NaN }, { latitude: 91 }, { latitude: -91 },
    { longitude: Infinity }, { longitude: 181 }, { longitude: -181 },
  ]) {
    await assert.rejects(model.criarRelato({ ...dados, ...ponto }), { status: 422, campo: "localizacao" });
  }
  assert.equal(pool.chamadas.length, 0);
});

test("referencia vazia e gravada como NULL", async () => {
  const { pool, model } = preparar([
    [{ id: 7 }], [{ id: 2 }], [{ id: 12, cidade_id: 1 }], { insertId: 50 }, {},
  ]);
  await model.criarRelato({ ...dados, referencia: "" });
  assert.equal(pool.chamadas[4].parametros.at(-1), null);
});

test("falha no historico solicita rollback do relato e libera conexao", async () => {
  const pool = criarPoolFalso({ resultados: [
    [{ id: 7 }], [{ id: 2 }], [{ id: 12, cidade_id: 1 }], { insertId: 50 },
  ] });
  const adquirir = pool.getConnection;
  const falha = new Error("Falha simulada no historico");
  pool.getConnection = async () => {
    const conexao = await adquirir();
    const consultar = conexao.query;
    conexao.query = async (sql, parametros) => {
      if (sql.includes("INSERT INTO historico_status_relato")) throw falha;
      return consultar(sql, parametros);
    };
    return conexao;
  };
  await assert.rejects(criarRelatoModel(pool).criarRelato(dados), falha);
  assert.equal(pool.chamadas.some(({ sql }) => sql === "COMMIT"), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(({ sql }) => sql), ["ROLLBACK", "RELEASE"]);
});
