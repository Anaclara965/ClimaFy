const poolPadrao = require('../config/db');
const { ultimaModeracao } = require('./relatoConsultaModel');
const LIMITE_EXPORTACAO = 5000;
function criarRelatorioModel(pool = poolPadrao, relogio = () => new Date()) {
  async function filtros() {
    // Inclui categorias/bairros históricos presentes nos relatos, mesmo se desativados.
    const [categorias] = await pool.query(`SELECT DISTINCT cat.slug, cat.nome FROM relatos r
      JOIN categorias_ocorrencia cat ON cat.id = r.categoria_id WHERE r.deleted_at IS NULL ORDER BY cat.nome, cat.slug`);
    const [bairros] = await pool.query(`SELECT DISTINCT b.id, b.nome, c.nome AS cidade FROM relatos r
      JOIN bairros b ON b.id = r.bairro_id JOIN cidades c ON c.id = r.cidade_id
      WHERE r.deleted_at IS NULL ORDER BY c.nome, b.nome, b.id`);
    return { categorias: categorias.map(c => ({ slug: c.slug, nome: c.nome })),
      bairros: bairros.map(b => ({ id: Number(b.id), nome: b.nome, cidade: b.cidade })), limite: LIMITE_EXPORTACAO };
  }
  async function exportar({ dias = 30, categoria, bairro, status } = {}) {
    const agora = relogio(), condicoes = ['r.deleted_at IS NULL', 'r.created_at < ?'], parametros = [agora];
    if (dias !== null) { condicoes.push('r.created_at >= ?'); parametros.push(new Date(+agora - dias * 86400000)); }
    if (categoria) { condicoes.push('cat.slug = ?'); parametros.push(categoria); }
    if (bairro) { condicoes.push('r.bairro_id = ?'); parametros.push(bairro); }
    if (status) { condicoes.push('r.status = ?'); parametros.push(status); }
    // SELECT explícito: não consulta usuários, textos livres, referências ou coordenadas.
    const [linhas] = await pool.query(`SELECT r.public_id, r.created_at, c.nome AS cidade, b.nome AS bairro,
      cat.nome AS categoria, r.gravidade, r.status, r.versao_conteudo, m.decisao,
      (SELECT COUNT(*) FROM relato_votos v WHERE v.relato_id = r.id) AS votos
      FROM relatos r JOIN bairros b ON b.id = r.bairro_id JOIN cidades c ON c.id = r.cidade_id
      JOIN categorias_ocorrencia cat ON cat.id = r.categoria_id ${ultimaModeracao}
      WHERE ${condicoes.join(' AND ')} ORDER BY r.created_at DESC, r.id DESC LIMIT ?`, [...parametros, LIMITE_EXPORTACAO + 1]);
    if (linhas.length > LIMITE_EXPORTACAO) throw Object.assign(new Error('A consulta ultrapassa 5.000 relatos. Reduza o período ou selecione outros filtros.'), { previsto: true, status: 422 });
    return { geradoEm: agora.toISOString(), relatos: linhas.map(r => ({ publicId: r.public_id,
      criadoEm: new Date(r.created_at).toISOString(), cidade: r.cidade, bairro: r.bairro, categoria: r.categoria,
      severidade: r.gravidade, status: r.status, moderacao: r.decisao || 'pendente', versao: String(r.versao_conteudo), votos: Number(r.votos) })) };
  }
  return { filtros, exportar };
}
module.exports = { ...criarRelatorioModel(), criarRelatorioModel, LIMITE_EXPORTACAO };
