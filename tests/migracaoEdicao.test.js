const test = require("node:test");
const assert = require("node:assert/strict");
const { migrarEdicao, definicoes } = require("../database/migrate-edicao-relatos");
const { criarPoolFalso } = require("./support/fakePool");

test("migração é aditiva, extrai somente a tabela nova e view versionada", async () => {
  const pool = criarPoolFalso({ resultados: [[{ obtido: 1 }], [], []] });
  assert.deepEqual(await migrarEdicao(pool), { ok: true, colunasAdicionadas: 2 });
  const comandos = pool.chamadas.map(c => c.sql);
  assert.equal(comandos.filter(c => c.startsWith("ALTER TABLE")).length, 2);
  assert.ok(comandos.some(c => c.startsWith("CREATE TABLE IF NOT EXISTS relato_revisoes")));
  assert.ok(comandos.some(c => c.startsWith("CREATE OR REPLACE VIEW")));
  assert.ok(comandos.every(c => !/^\s*(DROP|TRUNCATE|DELETE|UPDATE)\b/.test(c)));
  assert.match(definicoes().view, /PARTITION BY m.relato_id, m.versao_conteudo/);
  assert.match(definicoes().view, /decisao_final.versao_conteudo = r.versao_conteudo/);
  assert.match(definicoes().view, /WHERE r.deleted_at IS NULL/);
  assert.equal(comandos.at(-1), "RELEASE");
});

test("reexecução não recria colunas nem reescreve dados", async () => {
  const coluna = [{ Field: "versao_conteudo", Type: "int unsigned", Null: "NO", Default: "1" }];
  const pool = criarPoolFalso({ resultados: [[{ obtido: 1 }], coluna, coluna] });
  assert.equal((await migrarEdicao(pool)).colunasAdicionadas, 0);
  assert.ok(pool.chamadas.every(c => !c.sql.startsWith("ALTER")));
});

test("pré-validação incompatível não aplica DDL e libera trava/conexão", async () => {
  const pool = criarPoolFalso({ resultados: [[{ obtido: 1 }], [], [{ Field: "versao_conteudo", Type: "varchar(20)" }]] });
  await assert.rejects(migrarEdicao(pool), /incompatível/);
  assert.ok(pool.chamadas.every(c => !/^(ALTER|CREATE)/.test(c.sql)));
  assert.match(pool.chamadas.at(-2).sql, /RELEASE_LOCK/);
  assert.equal(pool.chamadas.at(-1).sql, "RELEASE");
});

test("migração concorrente não aplica mudanças", async () => {
  const pool = criarPoolFalso({ resultados: [[{ obtido: 0 }]] });
  await assert.rejects(migrarEdicao(pool), /andamento/);
  assert.equal(pool.chamadas.length, 2);
});
