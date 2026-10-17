const { validationResult, matchedData } = require("express-validator");
const relatoModel = require("../models/relatoModel");
const { responder422 } = require("../helpers/errosValidacao");
const midiaService = require("../services/midiaService");

async function criarRelato(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) return responder422(erros, res);

  // Apenas campos validados. O navegador nunca escolhe o autor ou a aprovação.
  const dados = matchedData(req, { locations: ["body"] });
  let midia;
  let persistido = false;
  req.processandoMidia = true;
  try {
    if (req.file) midia = await midiaService.salvar(req.file);
    const relato = await relatoModel.criarRelato({
      usuarioId: req.session.usuario.id,
      categoriaSlug: dados.categoria,
      bairroId: Number(dados.bairro),
      titulo: dados.titulo,
      descricao: dados.descricao,
      gravidade: dados.severidade,
      latitude: dados.latitude,
      longitude: dados.longitude,
      referencia: dados.referencia,
      ...(midia ? { midia } : {}),
    });
    persistido = true;
    return res.status(201).json({
      ok: true,
      mensagem: "Relato enviado para moderação.",
      publicId: relato.publicId,
      status: relato.status,
      publicado: false,
    });
  } catch (erro) {
    if (midia && !persistido && !erro.persistenciaIncerta) {
      try { await midiaService.remover(midia); }
      catch { console.warn(`[midia] Limpeza pendente do objeto privado ${midia.chave_arquivo}.`); }
    } else if (midia && !persistido) {
      console.warn(`[midia] Gravação incerta; preservar e reconciliar objeto privado ${midia.chave_arquivo}.`);
    }
    if (erro.previsto) return res.status(erro.status).json({ erro: erro.message });
    if (erro.campo && [403, 422].includes(erro.status)) {
      return res.status(erro.status).json({ erros: [erro.message] });
    }
    return next(erro);
  } finally { delete req.file; req.liberarMidia?.(); }
}

module.exports = { criarRelato };
