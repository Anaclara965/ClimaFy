const votos = require("../models/votoModel");
const { tokenRelatos } = require("../middlewares/csrfRelatos");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function consultarVotos(req, res, next) {
  res.set("Cache-Control", "no-store");
  const entrada = req.query.relatos;
  if (typeof entrada !== "string" || entrada.length > 1849) {
    return res.status(422).json({ erro: "Informe de 1 a 50 identificadores de relatos." });
  }
  const lista = entrada.split(",");
  if (lista.length > 50 || lista.some(id => !UUID.test(id))) {
    return res.status(422).json({ erro: "Informe de 1 a 50 identificadores de relatos válidos." });
  }
  try {
    return res.json({ votos: await votos.consultar({ publicIds: [...new Set(lista.map(id => id.toLowerCase()))],
      usuarioId: req.session.usuario.id }), csrfToken: tokenRelatos(req) });
  } catch (falha) { return next(falha); }
}

function definirVoto(votar) {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!UUID.test(req.params.publicId)) return res.status(404).json({ erro: "Relato não encontrado." });
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(422).json({ erro: "Envie um objeto JSON." });
    }
    try {
      const voto = await votos.definir({ publicId: req.params.publicId.toLowerCase(),
        usuarioId: req.session.usuario.id, votar });
      return res.json({ ok: true, voto, mensagem: votar ? "Voto registrado." : "Voto retirado." });
    } catch (falha) {
      if (falha.previsto) return res.status(falha.status).json({ erro: falha.message });
      return next(falha);
    }
  };
}

module.exports = { consultarVotos, votar: definirVoto(true), retirarVoto: definirVoto(false) };
