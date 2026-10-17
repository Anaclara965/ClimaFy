// Leitor CSV estrito para os dois arquivos locais conhecidos; não é endpoint de upload.
function lerCSV(texto, separador, esperados) {
  if (typeof texto !== 'string' || Buffer.byteLength(texto) > 10 * 1024 * 1024 || texto.includes('\0')) throw new Error('CSV inválido ou maior que 10 MiB.');
  const linhas = []; let linha = [], campo = '', estado = 'inicio';
  function finalizarCampo() { linha.push(campo); campo = ''; estado = 'inicio'; }
  function finalizarLinha() {
    finalizarCampo(); if (linha.some(v => v.trim() !== '')) linhas.push(linha); linha = [];
    if (linhas.length > 100001) throw new Error('CSV ultrapassa 100 mil registros.');
  }
  const fonte = texto.replace(/^\ufeff/, '');
  for (let i = 0; i < fonte.length; i++) {
    const c = fonte[i];
    if (estado === 'aspas') {
      if (c === '"') { if (fonte[i + 1] === '"') { campo += '"'; i++; } else estado = 'fechado'; }
      else campo += c;
    } else if (c === separador) finalizarCampo();
    else if (c === '\n' || c === '\r') { if (c === '\r' && fonte[i + 1] === '\n') i++; finalizarLinha(); }
    else if (c === '"' && estado === 'inicio') estado = 'aspas';
    else {
      if (c === '"' || estado === 'fechado') throw new Error('CSV com aspas fora do formato esperado.');
      campo += c; estado = 'texto';
    }
  }
  if (estado === 'aspas') throw new Error('CSV com aspas não fechadas.');
  if (campo || linha.length || estado === 'fechado') finalizarLinha();
  const cabecalhos = (linhas.shift() || []).map(c => c.trim());
  if (cabecalhos.length !== esperados.length || new Set(cabecalhos).size !== cabecalhos.length ||
      esperados.some(c => !cabecalhos.includes(c))) throw new Error('Cabeçalho do CSV diferente do contrato.');
  if (!linhas.length) throw new Error('CSV sem registros.');
  return linhas.map((valores, i) => {
    if (valores.length !== cabecalhos.length) throw new Error(`Registro ${i + 2} com quantidade de colunas incorreta.`);
    return Object.fromEntries(cabecalhos.map((c, j) => [c, valores[j].trim()]));
  });
}
module.exports = { lerCSV };
