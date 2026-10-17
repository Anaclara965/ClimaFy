const model = require('../models/notificacaoModel');
const { tokenRelatos } = require('../middlewares/csrfRelatos');
function invalido(mensagem) { return Object.assign(new Error(mensagem), { previsto: true, status: 422 }); }
function inteiro(valor, padrao, maximo) {
  if (valor === undefined) return padrao;
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || Number(valor) > maximo) throw invalido('Paginação inválida.');
  return Number(valor);
}
function semCache(req, res, next) { res.set('Cache-Control', 'no-store'); next(); }
function tratar(falha, res, next) { return falha.previsto ? res.status(falha.status).json({ erro: falha.message }) : next(falha); }
async function listar(req, res, next) {
  try {
    const q = req.query;
    if (Object.keys(q).some(k => !['pagina', 'limite', 'somenteNaoLidas'].includes(k))) throw invalido('Filtro não reconhecido.');
    if (q.somenteNaoLidas !== undefined && !['0', '1'].includes(q.somenteNaoLidas)) throw invalido('Use somenteNaoLidas=0 ou 1.');
    const dados = await model.listar({ usuarioId: req.session.usuario.id, pagina: inteiro(q.pagina, 1, 10000),
      limite: inteiro(q.limite, 10, 50), somenteNaoLidas: q.somenteNaoLidas === '1' });
    return res.json({ ...dados, csrfToken: tokenRelatos(req) });
  } catch (falha) { return tratar(falha, res, next); }
}
async function marcarLida(req, res, next) {
  try {
    const dados = req.body;
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Object.keys(dados).some(k => k !== 'id') ||
      typeof dados.id !== 'string' || !/^[1-9]\d{0,19}$/.test(dados.id) || BigInt(dados.id) > 18446744073709551615n) throw invalido('Informe o identificador da notificação como texto.');
    return res.json(await model.marcarLida({ usuarioId: req.session.usuario.id, id: dados.id }));
  } catch (falha) { return tratar(falha, res, next); }
}
module.exports = { semCache, listar, marcarLida };
