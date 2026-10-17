const ANO = 2026, FORMULA = '65-35-v1';
const PERIODOS = ['ano', '7d', '30d', '90d'];
function normalizarRegiao(valor) {
  const nome = String(valor).replace(/^[A-Z]{1,2}\s*-\s*/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ').replace(/[/_-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return { 'sao miguel paulista': 'sao miguel', 'mboi mirim': 'm boi mirim', 'casa verde cachoeirinha': 'casa verde' }[nome] || nome;
}
function classificar(indice) {
  if (indice >= 75) return { classificacao: 'Crítica', tom: 'critical' };
  if (indice >= 50) return { classificacao: 'Alta', tom: 'high' };
  if (indice >= 25) return { classificacao: 'Média', tom: 'medium' };
  return { classificacao: 'Baixa', tom: 'low' };
}
function inicioPeriodo(referencia, periodo, ano = ANO) {
  if (!PERIODOS.includes(periodo)) throw new Error('Período inválido para o ranking.');
  if (periodo === 'ano') return `${ano}-01-01`;
  const data = new Date(referencia + 'T12:00:00Z'); data.setUTCDate(data.getUTCDate() - (Number(periodo.slice(0, -1)) - 1));
  return [data.toISOString().slice(0, 10), `${ano}-01-01`].sort().at(-1);
}
function calcularRanking(orcamentos, contagens) {
  if (!orcamentos.length) return [];
  const quantidades = new Map(contagens.map(c => [String(c.subprefeituraId), c.total]));
  const maiorQuantidade = Math.max(1, ...quantidades.values());
  const investimentos = orcamentos.map(o => o.realizado), maiorInvestimento = Math.max(...investimentos);
  const intervalo = Math.max(1, maiorInvestimento - Math.min(...investimentos));
  return orcamentos.map(o => {
    const ocorrencias = quantidades.get(String(o.subprefeituraId)) || 0;
    const normalizadas = ocorrencias / maiorQuantidade, deficit = (maiorInvestimento - o.realizado) / intervalo;
    const indice = ocorrencias === 0 ? 0 : Math.round((normalizadas * 0.65 + deficit * 0.35) * 100);
    return { ...o, ocorrencias, normalizadas, deficit, indice, ...classificar(indice),
      valorPorOcorrencia: ocorrencias ? o.realizado / ocorrencias : null };
  }).sort((a, b) => b.indice - a.indice || b.ocorrencias - a.ocorrencias).map((r, i) => ({ ...r, posicao: i + 1 }));
}
module.exports = { ANO, FORMULA, PERIODOS, normalizarRegiao, classificar, inicioPeriodo, calcularRanking };
