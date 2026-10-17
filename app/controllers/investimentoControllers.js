const model = require('../models/investimentoModel');
const { ANO } = require('../helpers/ranking');
function inteiro(valor, padrao, maximo) {
  if (valor === undefined) return padrao;
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || Number(valor) > maximo) throw new Error('Paginação inválida.');
  return Number(valor);
}
async function consultar(req, res, next) {
  let filtros;
  try {
    const q = req.query;
    if (Object.keys(q).some(k => !['ano', 'busca', 'subprefeitura', 'ordem', 'pagina', 'limite'].includes(k)) ||
      Object.values(q).some(v => typeof v !== 'string')) throw new Error('Filtros inválidos.');
    if (q.ano !== undefined && q.ano !== String(ANO)) throw new Error(`Somente ${ANO} está disponível neste conjunto.`);
    if ((q.busca || '').length > 100) throw new Error('Busque por um texto de até 100 caracteres.');
    if (q.subprefeitura && (q.subprefeitura.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(q.subprefeitura))) throw new Error('Subprefeitura inválida.');
    if (q.ordem !== undefined && !['nome', 'realizado-maior', 'realizado-menor', 'execucao-maior'].includes(q.ordem)) throw new Error('Ordenação inválida.');
    filtros = { ano: ANO, busca: (q.busca || '').trim(), subprefeitura: q.subprefeitura || undefined, ordem: q.ordem || 'nome',
      pagina: inteiro(q.pagina, 1, 10000), limite: inteiro(q.limite, 20, 50) };
  } catch (erro) { return res.status(422).json({ erro: erro.message }); }
  try { return res.json(await model.consultar(filtros)); }
  catch (erro) { return erro.previsto ? res.status(erro.status).json({ erro: erro.message, codigo: erro.codigo }) : next(erro); }
}
module.exports = { consultar };
