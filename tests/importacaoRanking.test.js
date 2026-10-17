const test = require('node:test'), assert = require('node:assert/strict');
const { criarImportacaoRankingModel } = require('../app/models/importacaoRankingModel');
const { executar } = require('../database/importar-ranking');
const { textos, plano, poolImportacao } = require('./support/rankingFixture');
const pedido = () => ({ textos, assinatura: plano().assinatura, operadorPublicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
test('prévia é somente leitura e confirmação exata é obrigatória', async () => {
  const pool = poolImportacao(), model = criarImportacaoRankingModel(pool); assert.equal((await model.validar(textos)).ocorrencias, 192);
  assert.equal(pool.chamadas.some(c => /^(INSERT|UPDATE|DELETE)/.test(c.sql)), false);
  await assert.rejects(model.importar({ ...pedido(), assinatura: 'x' }), /Prévia desatualizada/);
  assert.equal(pool.chamadas.some(c => c.sql.startsWith('INSERT')), false);
});
test('importação usa uma transação, parâmetros, auditoria, quatro snapshots e não altera tabelas de usuários/relatos', async () => {
  const pool = poolImportacao(); const r = await criarImportacaoRankingModel(pool).importar(pedido());
  assert.equal(r.jaImportado, false); assert.equal(pool.chamadas.filter(c => c.sql.startsWith('INSERT INTO snapshots_prioridade')).length, 4);
  const linhas = pool.chamadas.filter(c => c.sql.startsWith('INSERT INTO snapshot_resultados')).flatMap(c => c.parametros);
  assert.equal(linhas.length / 6, 128); assert.equal(pool.chamadas.filter(c => c.sql === 'COMMIT').length, 1);
  assert.equal(pool.chamadas.some(c => /DELETE|REPLACE INTO|DROP|TRUNCATE|ALTER TABLE|UPDATE usuarios|UPDATE relatos/.test(c.sql)), false);
  assert.ok(pool.chamadas.some(c => c.sql.startsWith('INSERT INTO logs_auditoria')));
  assert.match(pool.chamadas.find(c => c.sql.includes('JOIN papeis')).sql, /p.codigo IN \('moderador','administrador'\)/);
  assert.equal(pool.chamadas.at(-1).sql, 'RELEASE'); assert.ok(pool.chamadas.at(-2).sql.includes('RELEASE_LOCK'));
});
test('mesmos arquivos concluídos não duplicam lotes, snapshots ou auditoria', async () => {
  const pool = poolImportacao({ existentes: true }); assert.equal((await criarImportacaoRankingModel(pool).importar(pedido())).jaImportado, true);
  assert.equal(pool.chamadas.some(c => /^(INSERT|UPDATE)/.test(c.sql)), false);
});
test('lote diferente é recusado e tudo reverte; não sobrescreve', async () => {
  const pool = poolImportacao({ existentes: true, outroHash: true });
  await assert.rejects(criarImportacaoRankingModel(pool).importar(pedido()), /não sobrescreve/);
  assert.ok(pool.chamadas.some(c => c.sql === 'ROLLBACK')); assert.equal(pool.chamadas.some(c => c.sql === 'COMMIT'), false);
});
test('auditoria indisponível reverte dados e snapshots; operador inválido/lock ocupado não importam', async () => {
  for (const opcoes of [{ falharAudit: true }, { ator: false }, { lock: false }]) {
    const pool = poolImportacao(opcoes); await assert.rejects(criarImportacaoRankingModel(pool).importar(pedido()));
    assert.equal(pool.chamadas.some(c => c.sql === 'COMMIT'), false); assert.equal(pool.chamadas.at(-1).sql, 'RELEASE');
  }
});
test('CLI sem argumentos só valida; argumentos incompletos/duplicados não gravam', async () => {
  let chamadas = 0; const model = { validar: async () => ({ previa: true }), importar: async () => { chamadas++; } };
  assert.deepEqual(await executar([], model), { previa: true });
  for (const args of [['--confirmar=' + 'a'.repeat(64)], ['--operador=x'], ['--arquivo=outro.csv'], ['--operador=' + 'a'.repeat(36), '--operador=' + 'a'.repeat(36)]]) await assert.rejects(executar(args, model));
  assert.equal(chamadas, 0);
});
