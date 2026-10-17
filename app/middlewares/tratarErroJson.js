// Erro do parser de JSON e entrada invalida (400), nao falha interna (500).
// Nao expor nem registrar error.body: pode conter senha ou outros dados pessoais.
function tratarErroJson(erro, req, res, next) {
  if (erro?.type !== "entity.parse.failed" || erro.status !== 400 || res.headersSent) return next(erro);
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(400).json({ erro: "JSON inválido. Confira o formato dos dados enviados." });
  }
  return res.status(400).render("pages/erro", {
    status: 400, titulo: "Dados inválidos",
    mensagem: "Não foi possível ler os dados enviados. Confira o formato da requisição.",
  });
}

module.exports = { tratarErroJson };
