const model = require('../models/rankingModel');
const { PERIODOS } = require('../helpers/ranking');
async function consultar(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const { periodo = 'ano', busca = '', ordem = 'prioridade' } = req.query;
  if (Object.keys(req.query).some(k => !['periodo', 'busca', 'ordem'].includes(k)) ||
    typeof periodo !== 'string' || !PERIODOS.includes(periodo) || typeof busca !== 'string' || busca.length > 100 ||
    typeof ordem !== 'string' || !['prioridade', 'orcamento'].includes(ordem)) return res.status(422).json({ erro: 'Filtros do ranking inválidos.' });
  try { return res.json(await model.consultar({ periodo, busca: busca.trim(), ordem })); }
  catch (falha) { return falha.previsto ? res.status(falha.status).json({ erro: falha.message, codigo: falha.codigo }) : next(falha); }
}
module.exports = { consultar };
