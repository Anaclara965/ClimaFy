const { validationResult, matchedData } = require("express-validator");
const model = require("../models/relatoAutorModel");
const consulta = require("../models/relatoConsultaModel");
const { tokenRelatos } = require("../middlewares/csrfRelatos");
const { versaoValida } = require("../helpers/versaoRelato");
const { responder422 } = require("../helpers/errosValidacao");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function mostrarEdicao(req, res, next) {
  res.set("Cache-Control", "no-store");
  try {
    const relato = UUID.test(req.params.publicId) ? await consulta.buscarPrivado(req.params.publicId,
      { autorId: req.session.usuario.id }) : null;
    if (!relato) return res.status(404).render("pages/erro", { status: 404,
      titulo: "Relato não encontrado", mensagem: "Este relato não está disponível para edição." });
    return res.render("pages/new-report", { edicao: { ...relato, csrfToken: tokenRelatos(req) } });
  } catch (falha) { return next(falha); }
}

function falhaPrevista(falha, res, next) {
  if (falha.previsto) return res.status(falha.status).json({ erro: falha.message });
  return next(falha);
}
async function editarRelato(req, res, next) {
  res.set("Cache-Control", "no-store");
  if (!UUID.test(req.params.publicId)) return res.status(404).json({ erro: "Relato não encontrado." });
  const erros = validationResult(req);
  if (!erros.isEmpty()) return responder422(erros, res);
  if (!versaoValida(req.body.versao)) return res.status(422).json({ erro: "Informe a versão que foi consultada." });
  const dados = matchedData(req, { locations: ["body"] });
  try {
    const resultado = await model.editar({ publicId: req.params.publicId.toLowerCase(), usuarioId: req.session.usuario.id,
      versao: req.body.versao, titulo: dados.titulo, descricao: dados.descricao,
      gravidade: dados.severidade, categoriaSlug: dados.categoria, bairroId: Number(dados.bairro),
      latitude: dados.latitude, longitude: dados.longitude, referencia: dados.referencia });
    return res.json({ ok: true, ...resultado, mensagem: resultado.alterado
      ? "Alterações salvas. O relato aguarda uma nova moderação." : "Nenhuma alteração no conteúdo. O relato foi mantido." });
  } catch (falha) { return falhaPrevista(falha, res, next); }
}
async function excluirRelato(req, res, next) {
  res.set("Cache-Control", "no-store");
  if (!UUID.test(req.params.publicId)) return res.status(404).json({ erro: "Relato não encontrado." });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || !versaoValida(req.body.versao)) {
    return res.status(422).json({ erro: "Informe a versão que foi consultada." });
  }
  try {
    const resultado = await model.excluir({ publicId: req.params.publicId.toLowerCase(),
      usuarioId: req.session.usuario.id, versao: req.body.versao });
    return res.json({ ok: true, ...resultado, mensagem: "Relato excluído da exibição. O histórico foi preservado." });
  } catch (falha) { return falhaPrevista(falha, res, next); }
}
module.exports = { mostrarEdicao, editarRelato, excluirRelato };
