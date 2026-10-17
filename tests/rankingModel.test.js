const test = require('node:test'), assert = require('node:assert/strict');
const { criarRankingModel } = require('../app/models/rankingModel');
const { criarPoolFalso } = require('./support/fakePool');
const { plano } = require('./support/rankingFixture');
function preparar({ periodo = 'ano', alterar } = {}) {
  const p = plano(), linhas = p.rankings[periodo].linhas;
  const respostas = [[], [{ id: '1', formula_versao: '65-35-v1', peso_ocorrencias: '0.650', peso_orcamento: '0.350', finalizado_em: new Date('2026-10-16T18:30:00Z') }],
    p.orcamentos.map(o => ({ subprefeitura_id: o.subprefeituraId, slug: o.slug, nome: o.nome, valor_previsto: String(o.previsto), valor_realizado: String(o.realizado), percentual_execucao: o.execucao.toFixed(2), execucao_original: String(o.execucao) })),
    [{ referencia: p.referencia, totalArquivo: '192', totalAno: '191' }],
    linhas.filter(l => l.ocorrencias).map(l => ({ subprefeituraId: l.subprefeituraId, total: String(l.ocorrencias) })),
    linhas.map(l => ({ subprefeitura_id: l.subprefeituraId, ocorrencias_normalizadas: l.normalizadas.toFixed(4), deficit_orcamentario_relativo: l.deficit.toFixed(4), pontuacao_final: String(l.indice), posicao: l.posicao })),
    [{ nome_arquivo: 'ocorrencias.csv', hash_arquivo: p.hashes.ocorrencias, linhas_importadas: 192 }, { nome_arquivo: 'orcamento.csv', hash_arquivo: p.hashes.orcamento, linhas_importadas: 32 }]];
  alterar?.(respostas); const pool = criarPoolFalso({ resultados: respostas }); return { pool, model: criarRankingModel(pool), linhas };
}
test('ranking lê snapshot finalizado, seus lotes e resultados na mesma transação somente leitura', async () => {
  const { pool, model, linhas } = preparar(); const r = await model.consultar();
  assert.equal(r.ranking.length, 32); assert.equal(r.resumo.ocorrencias, 191); assert.equal(r.resumo.areasMonitoradas, 32);
  assert.equal(r.metodologia.ocorrenciasForaAno, 1); assert.equal(r.metodologia.referencia, '2026-06-26');
  assert.equal(r.ranking[0].indice, linhas[0].indice); assert.equal(r.ranking[0].posicao, 1);
  assert.ok(r.ranking.every(v => !('subprefeituraId' in v))); assert.equal(r.fontes.length, 2);
  assert.match(pool.chamadas[0].sql, /READ ONLY/); assert.deepEqual(pool.chamadas[2].parametros, ['2026-ano']);
  assert.ok(pool.chamadas.filter(c => c.sql.includes('FROM ocorrencias_oficiais')).every(c => c.sql.includes('snapshot_lotes')));
  assert.equal(pool.chamadas.some(c => /^(INSERT|UPDATE|DELETE)/.test(c.sql)), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['COMMIT', 'RELEASE']);
});
test('período semanal usa referência do conjunto, não relógio do navegador', async () => {
  const { pool, model } = preparar({ periodo: '7d' }); const r = await model.consultar({ periodo: '7d' });
  assert.equal(r.metodologia.inicio, '2026-06-20'); assert.equal(r.metodologia.referencia, '2026-06-26');
  assert.deepEqual(pool.chamadas.find(c => c.sql.includes('GROUP BY o.subprefeitura_id')).parametros, ['2026-06-20', '2026-06-26', '1']);
});
test('busca normalizada não recalcula pesos/pontuação/resumo após filtrar', async () => {
  const { model } = preparar(); const r = await model.consultar({ busca: 'se' });
  assert.ok(r.ranking.some(v => v.nome === 'Sé')); assert.equal(r.resumo.areasMonitoradas, 32); assert.equal(r.resumo.ocorrencias, 191);
  const vazio = await preparar().model.consultar({ busca: 'inexistente' }); assert.deepEqual(vazio.ranking, []); assert.equal(vazio.resumo.areasMonitoradas, 32);
});
test('ordem por orçamento não substitui posição oficial por prioridade', async () => {
  const r = await preparar().model.consultar({ ordem: 'orcamento' });
  assert.ok(r.ranking.every((v, i, a) => i === 0 || a[i - 1].realizado <= v.realizado));
  assert.ok(r.ranking.some((v, i) => v.posicao !== i + 1));
});
test('sem snapshot/fórmula incompatível não inventa ranking e faz rollback', async () => {
  for (const alterar of [r => { r[1] = []; }, r => { r[1][0].peso_ocorrencias = '0.5'; }, r => { r[1][0].formula_versao = 'outra'; }]) {
    const { pool, model } = preparar({ alterar }); await assert.rejects(model.consultar(), { status: 503, codigo: 'RANKING_INDISPONIVEL' });
    assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['ROLLBACK', 'RELEASE']);
  }
});
test('lotes incompletos ou resultados alterados não passam como publicação válida', async () => {
  for (const alterar of [r => { r[5][0].pontuacao_final = '999'; }, r => { r[6].pop(); }, r => { r[3][0].referencia = null; }, r => { r[2].push(r[2][0]); },
    r => { r[2][0].execucao_original = 'inválido'; }, r => { r[2][0].valor_realizado = null; }, r => { r[5][0].ocorrencias_normalizadas = 'NaN'; }]) {
    await assert.rejects(preparar({ alterar }).model.consultar(), { status: 503 });
  }
});
