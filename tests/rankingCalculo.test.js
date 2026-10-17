const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { lerCSV } = require('../app/helpers/csvEntrada');
const { dinheiro, dataValida, prepararDados } = require('../app/helpers/prepararDadosRanking');
const { calcularRanking, normalizarRegiao, inicioPeriodo, classificar, PERIODOS } = require('../app/helpers/ranking');
const { textos, geografia, plano } = require('./support/rankingFixture');
test('CSV estrito aceita BOM/CRLF/aspas escapadas e campo com quebra de linha', () => {
  assert.deepEqual(lerCSV('\ufeffA;B\r\n"a;\r\nb";"c""d"\r\n', ';', ['A', 'B']), [{ A: 'a;\r\nb', B: 'c"d' }]);
});
test('CSV rejeita estrutura inconsistente em vez de importar parcialmente', () => {
  for (const texto of ['A;B\n"a;b', 'A;B\na;b;c', 'A;A\na;b', 'A;B\na"b;c', 'A;B\n"a"x;b', 'A;B\n', 'A;B\na;\0']) {
    assert.throws(() => lerCSV(texto, ';', ['A', 'B']));
  }
});
test('dinheiro é arredondado em centavos sem ponto flutuante; original fica preservado', () => {
  assert.equal(dinheiro('28303044.830000002'), '28303044.83'); assert.equal(dinheiro('78570670.17999999'), '78570670.18');
  assert.equal(dinheiro('1.005'), '1.01'); assert.equal(dinheiro('0,004'), '0.00'); assert.equal(dinheiro('12'), '12.00');
  for (const v of ['-1', '1e3', '', '1.000,00', '9999999999999.999', '10000000000000']) assert.throws(() => dinheiro(v));
  assert.equal(dataValida('2026-02-29'), false); assert.equal(dataValida('2024-02-29'), true);
});
test('normalização mantém aliases usados pelo projeto e períodos usam datas civis', () => {
  for (const [a, b] of [["MB - M'BOI MIRIM", 'm boi mirim'], ['São Miguel Paulista', 'sao miguel'], ['Freguesia do Ó/Brasilândia', 'freguesia do o brasilandia']]) assert.equal(normalizarRegiao(a), b);
  assert.equal(inicioPeriodo('2026-06-26', '7d'), '2026-06-20'); assert.equal(inicioPeriodo('2026-01-02', '90d'), '2026-01-01');
});
test('base real: 192 ocorrências preservadas, 191 anuais, 32 regiões e quatro rankings', () => {
  const p = plano(); assert.equal(p.ocorrencias.length, 192); assert.equal(p.previa.ocorrenciasAno, 191);
  assert.equal(p.previa.ocorrenciasForaAno, 1); assert.equal(p.previa.ajustesMonetarios, 6); assert.equal(p.referencia, '2026-06-26');
  assert.equal(p.rankings.ano.linhas.reduce((s, r) => s + r.ocorrencias, 0), 191);
  for (const periodo of PERIODOS) {
    assert.equal(p.rankings[periodo].linhas.length, 32); assert.ok(p.rankings[periodo].linhas.every(r => r.indice >= 0 && r.indice <= 100));
  }
  const vila = p.orcamentos.find(o => o.nome === 'Vila Mariana');
  assert.equal(vila.valores[4], '28303044.83'); assert.equal(vila.original.Realizado, '28303044.830000002');
});
test('fórmula preserva 65/35, classificação e regra de zero ocorrências', () => {
  const r = calcularRanking([{ subprefeituraId: '1', realizado: 100 }, { subprefeituraId: '2', realizado: 0 }, { subprefeituraId: '3', realizado: 0 }],
    [{ subprefeituraId: '1', total: 10 }, { subprefeituraId: '2', total: 5 }]);
  assert.deepEqual(r.map(x => [x.subprefeituraId, x.indice]), [['2', 68], ['1', 65], ['3', 0]]);
  assert.equal(classificar(75).classificacao, 'Crítica'); assert.equal(classificar(50).classificacao, 'Alta');
  assert.equal(classificar(25).classificacao, 'Média'); assert.equal(classificar(24).classificacao, 'Baixa');
  assert.deepEqual(calcularRanking([], []), []);
});
test('cálculo do backend coincide com o JS anterior nos quatro períodos, após excluir 2025 do ano', async () => {
  const p = plano(), contexto = vm.createContext({ window: {}, URL, document: { currentScript: { src: 'http://localhost/js/dados-publicos.js' } },
    fetch: async url => ({ ok: true, text: async () => String(url).includes('orcamento') ? textos.orcamentoTexto : textos.ocorrenciasTexto.split(/\r?\n/).filter(l => !l.includes(',2025-')).join('\n') }) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js/dados-publicos.js'), 'utf8'), contexto);
  for (const periodo of PERIODOS) {
    const antigo = await contexto.window.ClimaFyDados.carregarCruzamento({ periodo });
    for (const r of p.rankings[periodo].linhas) {
      const a = antigo.ranking.find(v => v.nome === r.nome); assert.equal(r.indice, a.indice); assert.equal(r.ocorrencias, a.ocorrencias);
      assert.equal(r.classificacao, a.classificacao); assert.ok(Math.abs(r.realizado - a.realizado) < 0.000001);
    }
  }
});
test('prévia recusa data inválida, coordenada, geografia, orçamento duplicado e ID externo duplicado', () => {
  for (const alteracao of [
    { ocorrenciasTexto: textos.ocorrenciasTexto.replace('2026-04-01', '2026-02-30') },
    { ocorrenciasTexto: textos.ocorrenciasTexto.replace('POINT (-46.53682080000042', 'POINT (-181') },
    { geografia: geografia.slice(1) },
    { orcamentoTexto: textos.orcamentoTexto + '\n' + textos.orcamentoTexto.split(/\r?\n/)[1] },
    { ocorrenciasTexto: textos.ocorrenciasTexto + '\n' + textos.ocorrenciasTexto.split(/\r?\n/)[1] },
  ]) assert.throws(() => prepararDados({ ...textos, geografia, ...alteracao }));
});
