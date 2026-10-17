// Valores vindos de DECIMAL(15,2): somas em centavos, sem acumular ponto flutuante.
function centavos(valor) {
  if (typeof valor !== 'string' || !/^(?:0|[1-9]\d{0,12})\.\d{2}$/.test(valor)) throw new Error('Valor DECIMAL inválido no orçamento.');
  return BigInt(valor.replace('.', ''));
}
function decimal(valor) {
  const texto = valor.toString().padStart(3, '0'); return texto.slice(0, -2) + '.' + texto.slice(-2);
}
function percentualSobrePrevisto(realizado, previsto) {
  if (previsto === 0n) return null;
  return decimal((realizado * 10000n + previsto / 2n) / previsto);
}
const CAMPOS_MONETARIOS = ['previsto', 'atualizado', 'congelado', 'descongelado', 'realizado'];
function resumir(linhas) {
  const somas = Object.fromEntries(CAMPOS_MONETARIOS.map(c => [c, linhas.reduce((total, l) => total + l.centavos[c], 0n)]));
  return { subprefeituras: linhas.length, ...Object.fromEntries(CAMPOS_MONETARIOS.map(c => [c, decimal(somas[c])])),
    execucaoSobrePrevisto: percentualSobrePrevisto(somas.realizado, somas.previsto) };
}
module.exports = { centavos, decimal, percentualSobrePrevisto, CAMPOS_MONETARIOS, resumir };
