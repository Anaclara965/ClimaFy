const consulta = require("../models/relatoConsultaModel");
const moderacao = require("../models/moderacaoModel");
const { tokenRelatos } = require("../middlewares/csrfRelatos");
const { versaoValida } = require("../helpers/versaoRelato");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SITUACOES = ["aberto", "em_andamento", "resolvido"];
const DECISOES = ["aprovado", "rejeitado", "solicitado_ajuste"];
const CATEGORIAS = ["alagamento", "queimada", "calor-extremo", "arvore-caida", "lixo", "poluicao-agua"];
function erro(mensagem, status = 400) { return Object.assign(new Error(mensagem), { previsto: true, status }); }
function inteiro(valor, padrao, maximo) {
  if (valor === undefined) return padrao;
  if (typeof valor !== "string" || !/^\d+$/.test(valor) || Number(valor) < 1 || Number(valor) > maximo) {
    throw erro("Parâmetro numérico inválido.");
  }
  return Number(valor);
}
function escolha(valor, permitidos, padrao) {
  if (valor === undefined) return padrao;
  if (typeof valor !== "string" || !permitidos.includes(valor)) throw erro("Filtro inválido.");
  return valor;
}
function texto(valor, maximo, padrao = "") {
  if (valor === undefined) return padrao;
  if (typeof valor !== "string" || valor.length > maximo) throw erro("Texto inválido ou muito longo.");
  return valor.trim();
}
function filtros(req, privado = false) {
  const q = req.query;
  return { pagina: inteiro(q.pagina, 1, 10000), limite: inteiro(q.limite, 12, 50),
    busca: texto(q.busca, 100), ...(privado ? {
      decisao: escolha(q.decisao, ["todos", "pendente", ...DECISOES], "pendente"),
      ordem: escolha(q.ordem, ["oldest", "newest"], "oldest"),
    } : {
      status: escolha(q.status, SITUACOES), categoria: escolha(q.categoria, CATEGORIAS),
      bairro: inteiro(q.bairro, undefined, Number.MAX_SAFE_INTEGER),
      dias: q.dias === undefined ? undefined : Number(escolha(q.dias, ["1", "7", "30"])),
      ordem: escolha(q.ordem, ["recent", "oldest", "votes"], "recent"),
    }) };
}
function tratar(falha, res, next) {
  if (falha.previsto) return res.status(falha.status).json({ erro: falha.message });
  return next(falha);
}
async function listarPublicos(req, res, next) {
  res.set("Cache-Control", "no-store");
  try { return res.json(await consulta.listar(filtros(req))); }
  catch (falha) { return tratar(falha, res, next); }
}
async function listarMeus(req, res, next) {
  res.set("Cache-Control", "no-store");
  try { return res.json(await consulta.listar({ ...filtros(req), autorId: req.session.usuario.id })); }
  catch (falha) { return tratar(falha, res, next); }
}
async function listarModeracao(req, res, next) {
  res.set("Cache-Control", "no-store");
  try { return res.json({ ...await moderacao.listar(filtros(req, true)), csrfToken: tokenRelatos(req) }); }
  catch (falha) { return tratar(falha, res, next); }
}
function detalhe(tipo) {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const api = req.originalUrl.startsWith("/api/");
    try {
      const id = req.params.publicId;
      const relato = !UUID.test(id) ? null : tipo === "publico"
        ? await consulta.buscarPublico(id)
        : await consulta.buscarPrivado(id, { autorId: req.session.usuario.id, moderador: tipo === "moderador" });
      if (!relato) {
        if (api) return res.status(404).json({ erro: "Relato não encontrado." });
        return res.status(404).render("pages/erro", { status: 404, titulo: "Relato não encontrado",
          mensagem: "Este relato não está disponível para consulta." });
      }
      if (api) return res.json({ relato, ...(tipo === "autor" ? { csrfToken: tokenRelatos(req) } : {}) });
      return res.render("pages/relato-detalhe", { relato, modo: tipo,
        csrfToken: tipo !== "publico" ? tokenRelatos(req) : "" });
    } catch (falha) { return next(falha); }
  };
}
async function alterarModeracao(req, res, next) {
  try {
    if (!UUID.test(req.params.publicId)) throw erro("Relato não encontrado.", 404);
    const dados = req.body;
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw erro("Envie os campos da ação.", 422);
    if (typeof dados.revisao !== "string" || !/^\d{1,20}$/.test(dados.revisao)) throw erro("Informe a revisão consultada na lista.", 422);
    if (!versaoValida(dados.versao)) throw erro("Informe a versão consultada na lista.", 422);
    const decisao = escolha(dados.decisao, DECISOES);
    if (!decisao) throw erro("Selecione a decisão.", 422);
    const motivo = decisao === "aprovado" ? undefined : texto(dados.motivo, 40);
    if (decisao !== "aprovado" && !motivo) throw erro("Selecione um motivo.", 422);
    const observacao = texto(dados.observacao, 255);
    return res.json(await moderacao.alterar({ publicId: req.params.publicId,
      moderadorId: req.session.usuario.id, revisao: dados.revisao, versao: dados.versao, decisao, motivo, observacao }));
  } catch (falha) { return tratar(falha, res, next); }
}
async function alterarSituacao(req, res, next) {
  try {
    if (!UUID.test(req.params.publicId)) throw erro("Relato não encontrado.", 404);
    const dados = req.body;
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw erro("Envie os campos da ação.", 422);
    if (!versaoValida(dados.versao)) throw erro("Informe a versão consultada no detalhe.", 422);
    const situacao = escolha(dados.status, SITUACOES);
    const statusAnterior = escolha(dados.statusAnterior, SITUACOES);
    if (!situacao || !statusAnterior) throw erro("Informe a situação atual e a nova situação.", 422);
    return res.json(await moderacao.alterar({ publicId: req.params.publicId,
      moderadorId: req.session.usuario.id, versao: dados.versao, situacao, statusAnterior, observacao: texto(dados.observacao, 255) }));
  } catch (falha) { return tratar(falha, res, next); }
}
module.exports = { listarPublicos, listarMeus, listarModeracao,
  detalhePublico: detalhe("publico"), detalheMeu: detalhe("autor"), detalheModeracao: detalhe("moderador"),
  alterarModeracao, alterarSituacao };
