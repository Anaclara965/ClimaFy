const model = require("../models/adminModel");
const { tokenRelatos } = require("../middlewares/csrfRelatos");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function escolha(valor, valores) {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string" || !valores.includes(valor)) throw Object.assign(new Error("Filtro inválido."), { previsto: true, status: 422 });
  return valor;
}
function inteiro(valor, padrao, maximo) {
  if (valor === undefined) return padrao;
  if (typeof valor !== "string" || !/^[1-9]\d*$/.test(valor) || Number(valor) > maximo) {
    throw Object.assign(new Error("Paginação inválida."), { previsto: true, status: 422 });
  }
  return Number(valor);
}
function tratar(falha, res, next) {
  return falha.previsto ? res.status(falha.status).json({ erro: falha.message }) : next(falha);
}
function semCache(req, res, next) { res.set("Cache-Control", "no-store"); next(); }
async function listarUsuarios(req, res, next) {
  try {
    const busca = req.query.busca ?? "";
    if (typeof busca !== "string" || busca.length > 100) return res.status(422).json({ erro: "Busque por um texto de até 100 caracteres." });
    const resultado = await model.listarUsuarios({ busca: busca.trim(), status: escolha(req.query.status, ["ativo", "pendente", "inativo", "bloqueado"]),
      papel: escolha(req.query.papel, ["cidadao", "moderador", "administrador"]),
      pagina: inteiro(req.query.pagina, 1, 10000), limite: inteiro(req.query.limite, 20, 50) });
    return res.json({ ...resultado, csrfToken: tokenRelatos(req) });
  } catch (falha) { return tratar(falha, res, next); }
}
async function alterarStatus(req, res, next) {
  if (!UUID.test(req.params.publicId)) return res.status(404).json({ erro: "Usuário não encontrado." });
  const dados = req.body;
  if (!dados || typeof dados !== "object" || Array.isArray(dados) ||
      !["ativo", "bloqueado"].includes(dados.status) || !["ativo", "bloqueado"].includes(dados.statusAnterior)) {
    return res.status(422).json({ erro: "Informe o status consultado e o novo status (ativo ou bloqueado)." });
  }
  try { return res.json(await model.alterarStatus({ publicId: req.params.publicId.toLowerCase(),
    administradorId: req.session.usuario.id, status: dados.status, statusAnterior: dados.statusAnterior })); }
  catch (falha) { return tratar(falha, res, next); }
}
async function dashboard(req, res, next) {
  try { return res.json(await model.dashboard()); }
  catch (falha) { return next(falha); }
}
module.exports = { semCache, listarUsuarios, alterarStatus, dashboard };
