const { randomBytes, timingSafeEqual } = require("node:crypto");

function tokenConta(req) {
  req.session.csrfConta ??= randomBytes(32).toString("hex");
  return req.session.csrfConta;
}

function exigirCsrfConta(req, res, next) {
  const recebido = req.body?._csrf;
  const esperado = req.session?.csrfConta;
  if (typeof recebido !== "string" || !/^[a-f0-9]{64}$/.test(recebido) ||
      typeof esperado !== "string" || !/^[a-f0-9]{64}$/.test(esperado) ||
      !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
    return res.status(403).render("pages/erro", {
      status: 403,
      titulo: "Formulário expirado",
      mensagem: "Atualize a página da sua conta e tente novamente.",
    });
  }
  return next();
}

module.exports = { tokenConta, exigirCsrfConta };
