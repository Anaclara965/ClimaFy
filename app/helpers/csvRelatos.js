// CSV para leitura humana em planilhas: delimitador pt-BR, UTF-8 e linhas CRLF.
// Aspas protegem separadores/quebras de linha. O prefixo reduz interpretação de fórmulas.
function celula(valor) {
  let texto = String(valor ?? '').replace(/\u0000/g, '');
  if (/^[\s\u0000-\u001f\u007f\ufeff]*[=+\-@＝＋－＠]/u.test(texto) || /^[\t\r\n]/.test(texto)) texto = "'" + texto;
  return '"' + texto.replaceAll('"', '""') + '"';
}
const colunas = [
  ['Identificador do relato', 'publicId'], ['Criado em (UTC)', 'criadoEm'], ['Cidade', 'cidade'], ['Bairro', 'bairro'],
  ['Categoria', 'categoria'], ['Severidade', 'severidade'], ['Situação', 'status'], ['Moderação da versão atual', 'moderacao'],
  ['Versão do conteúdo', 'versao'], ['Votos', 'votos'],
];
function csvRelatos(relatos) {
  const linhas = [colunas.map(([titulo]) => celula(titulo)).join(';'),
    ...relatos.map(r => colunas.map(([, chave]) => celula(r[chave])).join(';'))];
  return '\ufeff' + linhas.join('\r\n') + '\r\n';
}
module.exports = { csvRelatos, celula };
