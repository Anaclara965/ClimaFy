const { randomBytes, timingSafeEqual } = require("node:crypto");

function tokenRelatos(req) {
  req.session.csrfRelatos ??= randomBytes(32).toString("hex");
  return req.session.csrfRelatos;
}

function exigirTokenRelatos(req, res, next) {
  const recebido = req.get("X-CSRF-Token");
  const esperado = req.session?.csrfRelatos;
  if (typeof recebido !== "string" || !/^[a-f0-9]{64}$/.test(recebido) || !esperado || recebido.length !== esperado.length ||
      !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
    return res.status(403).json({ erro: "Atualize a página antes de realizar esta ação." });
  }
  return next();
}

function exigirCsrfRelatos(req, res, next) {
  return exigirTokenRelatos(req, res, () => {
    // As ações JSON existentes continuam recusando multipart/formulário.
    if (!req.is("application/json")) return res.status(415).json({ erro: "Envie application/json." });
    return next();
  });
}

module.exports = { tokenRelatos, exigirCsrfRelatos, exigirTokenRelatos };
