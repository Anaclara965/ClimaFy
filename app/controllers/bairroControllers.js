// GET /api/bairros?busca=termo
// Fonte unica dos bairros: autocomplete do cadastro e busca das preferencias.
const { buscarBairros } = require("../models/bairroModel");

const TAMANHO_MAXIMO_TERMO = 100;
const LIMITE_RESULTADOS = 20;

async function listarBairros(req, res, next) {
  const busca = req.query.busca ?? "";

  if (typeof busca !== "string" || busca.length > TAMANHO_MAXIMO_TERMO) {
    return res.status(400).json({
      erro: "A busca deve ser um texto de até 100 caracteres.",
    });
  }

  try {
    const encontrados = await buscarBairros(busca.trim(), LIMITE_RESULTADOS);
    return res.status(200).json(encontrados);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { listarBairros, TAMANHO_MAXIMO_TERMO, LIMITE_RESULTADOS };

