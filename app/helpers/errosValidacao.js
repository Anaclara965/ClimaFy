// Converte o resultado do express-validator em lista de mensagens para as views.
// Usado por todos os controllers que re-renderizam formulario com erro (422).
function mensagens(resultado) {
  return resultado.array().map((erro) => erro.msg);
}

// Mesmo conteudo, mas no formato de contrato das rotas de API: { erros: [...] }.
function responder422(resultado, res) {
  return res.status(422).json({ erros: mensagens(resultado) });
}

module.exports = { mensagens, responder422 };
