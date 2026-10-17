const model = require('../models/relatorioModel');
const { csvRelatos } = require('../helpers/csvRelatos');
function invalido(mensagem) { return Object.assign(new Error(mensagem), { previsto: true, status: 422 }); }
function validarFiltros(query) {
  const permitidos = ['dias', 'categoria', 'bairro', 'status'];
  if (Object.keys(query).some(chave => !permitidos.includes(chave))) throw invalido('Filtro não reconhecido.');
  for (const valor of Object.values(query)) if (typeof valor !== 'string') throw invalido('Informe cada filtro apenas uma vez, como texto.');
  const periodo = query.dias ?? '30';
  if (!['7', '30', '90', '365', 'todos'].includes(periodo)) throw invalido('Selecione um período válido (7, 30, 90, 365 ou todos).');
  const categoria = query.categoria || undefined, bairro = query.bairro || undefined, status = query.status || undefined;
  if (categoria && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categoria)) throw invalido('Categoria inválida.');
  if (categoria?.length > 80) throw invalido('Categoria inválida.');
  if (bairro && (!/^[1-9]\d{0,9}$/.test(bairro) || Number(bairro) > 4294967295)) throw invalido('Bairro inválido.');
  if (status && !['aberto', 'em_andamento', 'resolvido'].includes(status)) throw invalido('Situação inválida.');
  return { dias: periodo === 'todos' ? null : Number(periodo), categoria, bairro: bairro ? Number(bairro) : undefined, status };
}
async function filtros(req, res, next) {
  try { return res.json(await model.filtros()); } catch (erro) { return next(erro); }
}
async function exportar(req, res, next) {
  try {
    const dados = await model.exportar(validarFiltros(req.query));
    const arquivo = 'climafy-relatos-' + dados.geradoEm.replace(/[-:]/g, '').slice(0, 15).replace('T', '-') + '.csv';
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${arquivo}"`,
      'X-Content-Type-Options': 'nosniff', 'X-Relatos-Total': String(dados.relatos.length), 'X-Gerado-Em': dados.geradoEm });
    return res.send(csvRelatos(dados.relatos));
  } catch (erro) { return erro.previsto ? res.status(erro.status).json({ erro: erro.message }) : next(erro); }
}
module.exports = { filtros, exportar, validarFiltros };
