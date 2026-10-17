const test = require("node:test");
const assert = require("node:assert/strict");
const { criarMidiaModel } = require("../app/models/midiaModel");
const { criarRelatoModel } = require("../app/models/relatoModel");
const { criarPoolFalso } = require("./support/fakePool");
const midia = { tipo: "foto", chave_arquivo: "climafy/relatos/12345678-1234-4234-8234-123456789abc", mime_type: "image/png", tamanho_bytes: 100 };
const dados = { usuarioId: 7, categoriaSlug: "alagamento", bairroId: 3, titulo: "Título", descricao: "Descrição",
  gravidade: "grave", latitude: -23, longitude: -46, midia };

test("consulta pública só usa view da versão aprovada; IDs de mídia preservados em texto", async () => {
  const pool = criarPoolFalso({ resultados: [[{ relato_id: 1, id: null }]] });
  assert.deepEqual(await criarMidiaModel(pool).listar("uuid"), []);
  assert.match(pool.chamadas[0].sql, /FROM vw_relatos_publicos/);
  assert.match(pool.chamadas[0].sql, /CAST\(m.id AS CHAR\)/);
  assert.deepEqual(pool.chamadas[0].parametros, ["uuid"]);
});

test("consulta do autor exige autoria e não exclusão; moderação lê privado sem liberar outros", async () => {
  const pool = criarPoolFalso({ resultados: [[], [{ id: "123", ...midia }]] });
  const model = criarMidiaModel(pool);
  assert.equal(await model.listar("uuid", { autorId: 7 }), null);
  assert.match(pool.chamadas[0].sql, /AND r.usuario_id = \?/);
  assert.match(pool.chamadas[0].sql, /deleted_at IS NULL/);
  assert.deepEqual(pool.chamadas[0].parametros, ["uuid", 7]);
  assert.equal((await model.listar("uuid", { moderador: true })).length, 1);
  assert.deepEqual(pool.chamadas[1].parametros, ["uuid"]);
});

test("relato, histórico e mídia persistem na mesma transação, sem aprovação automática", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 7 }], [{ id: 1 }], [{ id: 3, cidade_id: 1 }], { insertId: 10 }, {}, {}] });
  await criarRelatoModel(pool).criarRelato(dados);
  const insercao = pool.chamadas.find(c => c.sql.includes("INSERT INTO relato_midias"));
  assert.deepEqual(insercao.parametros, [10, midia.tipo, midia.chave_arquivo, midia.mime_type, 100]);
  assert.ok(pool.chamadas.indexOf(insercao) < pool.chamadas.findIndex(c => c.sql === "COMMIT"));
  assert.ok(pool.chamadas.every(c => c.rotulo === "conexao"));
  assert.equal(pool.chamadas.some(c => c.sql.includes("INSERT INTO moderacoes_relato")), false);
});

test("metadados de mídia inválidos nem abrem conexão", async () => {
  const pool = criarPoolFalso();
  await assert.rejects(criarRelatoModel(pool).criarRelato({ ...dados, midia: { ...midia, chave_arquivo: "../../ataque" } }), { status: 422 });
  assert.equal(pool.chamadas.length, 0);
});

for (const etapa of ["INSERT INTO relato_midias", "COMMIT", "ROLLBACK"]) {
  test(`falha em ${etapa} não anuncia sucesso e sinaliza incerteza quando necessário`, async () => {
    const pool = criarPoolFalso({ resultados: [[{ id: 7 }], [{ id: 1 }], [{ id: 3, cidade_id: 1 }], { insertId: 10 }, {}] });
    const obter = pool.getConnection;
    pool.getConnection = async () => {
      const conexao = await obter(); const query = conexao.query;
      conexao.query = async (sql, valores) => {
        if (sql.includes("INSERT INTO relato_midias") && etapa !== "COMMIT") throw new Error("Inserção falhou");
        return query(sql, valores);
      };
      if (etapa === "COMMIT") conexao.commit = async () => { throw new Error("Conexão perdida no commit"); };
      if (etapa === "ROLLBACK") conexao.rollback = async () => { throw new Error("Conexão perdida no rollback"); };
      return conexao;
    };
    await assert.rejects(criarRelatoModel(pool).criarRelato(dados), falha => {
      assert.equal(Boolean(falha.persistenciaIncerta), etapa !== "INSERT INTO relato_midias"); return true;
    });
    assert.equal(pool.chamadas.at(-1).sql, "RELEASE");
  });
}
