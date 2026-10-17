const { createHash } = require('node:crypto');
const { lerCSV } = require('./csvEntrada');
const { ANO, FORMULA, normalizarRegiao, PERIODOS, inicioPeriodo, calcularRanking } = require('./ranking');
const CAB_OC = ['FID', 'cd_identificador', 'dt_ocorrencia', 'dc_tipo_ocorrencia', 'nm_distrito', 'ge_ponto', 'dt_carga', 'nm_subprefeitura', 'sg_fonte_original'];
const CAB_ORC = ['Órgão', `Valor previsto para ${ANO}`, 'Valor Orçado Atualizado', 'Valor Congelado', 'Valor Descongelado', 'Realizado', 'Executado (%)'];
const hash = texto => createHash('sha256').update(texto).digest('hex');
function dataValida(valor) { return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor + 'T12:00:00Z')) && new Date(valor + 'T12:00:00Z').toISOString().slice(0, 10) === valor; }
function dinheiro(valor) {
  if (!/^(?:0|[1-9]\d{0,12})(?:[.,]\d{1,18})?$/.test(valor)) throw new Error('Valor monetário inválido ou fora de DECIMAL(15,2).');
  const [inteiro, decimal = ''] = valor.replace(',', '.').split('.');
  let centavos = BigInt(inteiro) * 100n + BigInt(decimal.slice(0, 2).padEnd(2, '0'));
  if (decimal[2] >= '5') centavos++;
  if (centavos > 999999999999999n) throw new Error('Arredondamento monetário excede DECIMAL(15,2).');
  const texto = centavos.toString().padStart(3, '0'); return texto.slice(0, -2) + '.' + texto.slice(-2);
}
function prepararDados({ ocorrenciasTexto, orcamentoTexto, geografia }) {
  const regioes = new Map();
  for (const g of geografia) {
    const chave = normalizarRegiao(g.nome_normalizado);
    if (regioes.has(chave)) throw new Error('Geografia com nome normalizado ambíguo.');
    regioes.set(chave, g);
  }
  const geo = nome => { const g = regioes.get(normalizarRegiao(nome)); if (!g) throw new Error(`Região sem correspondência: ${nome}`); return g; };
  const ids = new Set();
  const ocorrencias = lerCSV(ocorrenciasTexto, ',', CAB_OC).map(l => {
    if (!l.cd_identificador || l.cd_identificador.length > 100 || ids.has(l.cd_identificador)) throw new Error('Identificador de ocorrência vazio, longo ou duplicado.');
    ids.add(l.cd_identificador);
    if (!dataValida(l.dt_ocorrencia) || !dataValida(l.dt_carga) || l.dc_tipo_ocorrencia !== 'ALAGAMENTO') throw new Error('Data ou tipo de ocorrência inválido.');
    const ponto = l.ge_ponto.match(/^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i);
    if (!ponto || Number(ponto[1]) < -180 || Number(ponto[1]) > 180 || Number(ponto[2]) < -90 || Number(ponto[2]) > 90) throw new Error('Coordenadas inválidas no CSV.');
    const g = geo(l.nm_subprefeitura);
    return { idExterno: l.cd_identificador, data: l.dt_ocorrencia, tipo: l.dc_tipo_ocorrencia, subprefeituraId: String(g.id),
      latitude: Number(ponto[2]).toFixed(7), longitude: Number(ponto[1]).toFixed(7), original: l };
  });
  const locais = new Set(); let totalCentavos = 0n, ajustesMonetarios = 0;
  const valorMonetario = v => { if ((v.split(/[.,]/)[1] || '').length > 2) ajustesMonetarios++; return dinheiro(v); };
  const orcamentos = lerCSV(orcamentoTexto, ';', CAB_ORC).map(l => {
    const g = geo(l['Órgão']); if (locais.has(String(g.id))) throw new Error('Orçamento duplicado para a mesma região.'); locais.add(String(g.id));
    if (l['Órgão'].length > 150 || !/^\d+(?:[.,]\d+)?$/.test(l['Executado (%)'])) throw new Error('Órgão ou percentual inválido.');
    const execucao = Number(l['Executado (%)'].replace(',', '.'));
    if (!Number.isFinite(execucao) || execucao < 0 || execucao > 999.99) throw new Error('Percentual fora de DECIMAL(5,2).');
    const previsto = valorMonetario(l[`Valor previsto para ${ANO}`]), realizado = valorMonetario(l.Realizado);
    totalCentavos += BigInt(realizado.replace('.', ''));
    return { subprefeituraId: String(g.id), slug: g.slug, nome: l['Órgão'], previsto: Number(previsto), realizado: Number(realizado), execucao,
      valores: [previsto, valorMonetario(l['Valor Orçado Atualizado']), valorMonetario(l['Valor Congelado']), valorMonetario(l['Valor Descongelado']), realizado, execucao.toFixed(2)], original: l };
  });
  if (locais.size !== regioes.size || !regioes.size) throw new Error('Orçamento não cobre exatamente o catálogo de regiões de São Paulo.');
  if (totalCentavos > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Total monetário excede a precisão segura do cálculo.');
  const doAno = ocorrencias.filter(o => o.data.startsWith(ANO + '-'));
  if (!doAno.length) throw new Error('Não há ocorrências no ano de referência.');
  const referencia = doAno.map(o => o.data).sort().at(-1);
  const rankings = Object.fromEntries(PERIODOS.map(periodo => {
    const inicio = inicioPeriodo(referencia, periodo), contagens = new Map();
    doAno.filter(o => o.data >= inicio && o.data <= referencia).forEach(o => contagens.set(o.subprefeituraId, (contagens.get(o.subprefeituraId) || 0) + 1));
    return [periodo, { inicio, referencia, linhas: calcularRanking(orcamentos, [...contagens].map(([subprefeituraId, total]) => ({ subprefeituraId, total }))) }];
  }));
  const hashes = { ocorrencias: hash(ocorrenciasTexto), orcamento: hash(orcamentoTexto) };
  const assinatura = hash(JSON.stringify({ hashes, formula: FORMULA, ano: ANO, geografia: geografia.map(g => [String(g.id), g.nome_normalizado, g.slug]).sort() }));
  return { ocorrencias, orcamentos, rankings, hashes, assinatura, ano: ANO, referencia,
    previa: { ocorrencias: ocorrencias.length, orcamentos: orcamentos.length, ocorrenciasAno: doAno.length,
      ocorrenciasForaAno: ocorrencias.length - doAno.length, ajustesMonetarios, referencia, formula: FORMULA, pesos: { ocorrencias: 0.65, orcamento: 0.35 }, assinatura, hashes } };
}
module.exports = { prepararDados, dinheiro, dataValida };
