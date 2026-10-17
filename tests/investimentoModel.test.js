const test = require('node:test'), assert = require('node:assert/strict');
const { criarInvestimentoModel } = require('../app/models/investimentoModel');
const { centavos, decimal, percentualSobrePrevisto, CAMPOS_MONETARIOS, resumir } = require('../app/helpers/orcamento');
const { criarPoolFalso } = require('./support/fakePool');
const { plano } = require('./support/rankingFixture');
function preparar(alterar) {
  const p = plano(), registros = p.orcamentos.map(o => ({ slug: o.slug, subprefeitura: o.nome, cidade: 'São Paulo', uf: 'SP', orgao: o.nome,
    ano: 2026, valor_previsto: o.valores[0], valor_atualizado: o.valores[1], valor_congelado: o.valores[2], valor_descongelado: o.valores[3],
    valor_realizado: o.valores[4], percentual_execucao: o.valores[5], execucao_original: o.original['Executado (%)'],
    usuario_id: 99, id: 123, segredo: 'NAO_EXPORTAR' }));
  const respostas = [[], [{ id: '1', finalizado_em: new Date('2026-10-16T18:30:00Z') }],
    [{ id: '12', nome_arquivo: 'orcamento_subprefeituras_sp_2026.csv', hash_arquivo: p.hashes.orcamento, linhas_importadas: '32', fonte: 'CSV local' }], registros];
  alterar?.(respostas); const pool = criarPoolFalso({ resultados: respostas }); return { pool, model: criarInvestimentoModel(pool) };
}
test('somas monetárias preservam centavos acima da precisão inteira do Number', () => {
  const valor = centavos('9999999999999.99');
  const l = { centavos: Object.fromEntries(CAMPOS_MONETARIOS.map(c => [c, valor])) };
  const resumo = resumir(Array(32).fill(l));
  assert.equal(resumo.previsto, '319999999999999.68'); assert.equal(resumo.realizado, resumo.previsto);
  assert.equal(resumo.execucaoSobrePrevisto, '100.00'); assert.equal(decimal(1n), '0.01');
});
test('percentual agregado é ponderado pelo previsto, arredonda e não divide por zero', () => {
  assert.equal(percentualSobrePrevisto(1n, 3n), '33.33'); assert.equal(percentualSobrePrevisto(2n, 3n), '66.67');
  assert.equal(percentualSobrePrevisto(200n, 100n), '200.00'); assert.equal(percentualSobrePrevisto(1n, 0n), null);
  const l = (p, r) => ({ centavos: { previsto: p, realizado: r, atualizado: 0n, congelado: 0n, descongelado: 0n } });
  assert.equal(resumir([l(10000n, 10000n), l(90000n, 0n)]).execucaoSobrePrevisto, '10.00');
});
test('DECIMAL inválido não vira zero ou arredondamento silencioso na consulta', () => {
  for (const valor of [null, 1, '-1.00', '1.0', '1e3', '01.00', '1.001', '10000000000000.00']) assert.throws(() => centavos(valor));
});
test('consulta lê apenas o lote publicado, mantém precisão e não expõe campos extras', async () => {
  const { pool, model } = preparar(); const r = await model.consultar();
  assert.equal(r.orcamentos.length, 20); assert.equal(r.resumo.subprefeituras, 32); assert.equal(r.resumoFiltrado.subprefeituras, 32);
  assert.deepEqual(r.paginacao, { pagina: 1, limite: 20, total: 32, paginas: 2 });
  assert.equal(r.fonte.dataAtualizacaoExterna, null); assert.equal(r.opcoes.subprefeituras.length, 32);
  assert.ok(r.orcamentos.every(o => /^\d+\.\d{2}$/.test(o.realizado))); assert.doesNotMatch(JSON.stringify(r), /NAO_EXPORTAR|usuario_id|segredo/);
  assert.match(pool.chamadas[0].sql, /READ ONLY/); assert.deepEqual(pool.chamadas[2].parametros, ['2026-ano']);
  assert.match(pool.chamadas[3].sql, /f.tipo_dado='orcamento'/); assert.deepEqual(pool.chamadas[4].parametros, ['12', 2026]);
  assert.equal(pool.chamadas.some(c => /^(INSERT|UPDATE|DELETE)/.test(c.sql)), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['COMMIT', 'RELEASE']);
});
test('busca sem acentos/aliases e slug usam totais filtrados, sem somar só a página', async () => {
  const r = await preparar().model.consultar({ busca: 'SE', limite: 50 });
  assert.ok(r.orcamentos.some(o => o.subprefeitura === 'Sé')); assert.equal(r.resumo.subprefeituras, 32);
  const parcial = await preparar().model.consultar({ busca: 'SE', limite: 1 });
  assert.equal(parcial.orcamentos.length, 1); assert.deepEqual(parcial.resumoFiltrado, r.resumoFiltrado);
  const um = await preparar().model.consultar({ subprefeitura: 'pinheiros' });
  assert.equal(um.orcamentos.length, 1); assert.equal(um.resumoFiltrado.realizado, '30835429.95');
  assert.equal(um.orcamentos[0].execucaoInformada, 45.00015476568417);
  const alias = await preparar().model.consultar({ busca: 'sao miguel paulista' }); assert.equal(alias.orcamentos[0].orgao, 'São Miguel');
});
test('paginação não repete regiões e ordenação monetária é exata', async () => {
  const primeira = await preparar().model.consultar(), segunda = await preparar().model.consultar({ pagina: 2 });
  assert.equal(segunda.orcamentos.length, 12); assert.equal(new Set([...primeira.orcamentos, ...segunda.orcamentos].map(o => o.slug)).size, 32);
  const maior = await preparar().model.consultar({ ordem: 'realizado-maior', limite: 50 });
  assert.equal(maior.orcamentos[0].orgao, 'Sé');
  assert.ok(maior.orcamentos.every((o, i, a) => !i || centavos(a[i - 1].realizado) >= centavos(o.realizado)));
  const execucao = await preparar().model.consultar({ ordem: 'execucao-maior' }); assert.equal(execucao.orcamentos[0].orgao, 'Freguesia do Ó/Brasilândia');
});
test('filtro sem resultado retorna lista/totais filtrados vazios sem apagar resumo global', async () => {
  const r = await preparar().model.consultar({ busca: 'inexistente' });
  assert.deepEqual(r.orcamentos, []); assert.equal(r.paginacao.paginas, 0); assert.equal(r.resumo.subprefeituras, 32);
  assert.equal(r.resumoFiltrado.realizado, '0.00'); assert.equal(r.resumoFiltrado.execucaoSobrePrevisto, null);
});
test('snapshot/lote ausente ou sobreposto não produz números fictícios', async () => {
  for (const alterar of [r => { r[1] = []; }, r => { r[2] = []; }, r => { r[2].push(r[2][0]); }, r => { r[2][0].linhas_importadas = 33; }, r => { r[3].push(r[3][0]); }]) {
    const { pool, model } = preparar(alterar); await assert.rejects(model.consultar(), { status: 503, codigo: 'ORCAMENTO_INDISPONIVEL' });
    assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['ROLLBACK', 'RELEASE']);
  }
});
test('valores/percentuais ausentes ou inválidos não são apresentados como zero', async () => {
  for (const alterar of [r => { r[3][0].valor_realizado = null; }, r => { r[3][0].valor_previsto = '1.001'; },
    r => { r[3][0].execucao_original = 'abc'; }, r => { r[3][0].execucao_original = null; r[3][0].percentual_execucao = null; }]) {
    await assert.rejects(preparar(alterar).model.consultar(), { status: 503 });
  }
});
