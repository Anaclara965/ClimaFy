const poolPadrao = require("../config/db");

function criarMidiaModel(pool = poolPadrao) {
  async function listar(publicId, { autorId, moderador = false } = {}) {
    // Uma consulta verifica a publicação/autoria e lê as mídias. Sem fallback
    // da view pública para relatos privados e sem chave enviada pelo cliente.
    const publico = autorId === undefined && !moderador;
    const fonte = publico ? "vw_relatos_publicos" : "relatos";
    const [linhas] = await pool.query(`SELECT r.id AS relato_id, CAST(m.id AS CHAR) AS id, m.tipo,
      m.chave_arquivo, m.mime_type, m.tamanho_bytes FROM ${fonte} r
      LEFT JOIN relato_midias m ON m.relato_id = r.id
      WHERE r.public_id = ? ${publico ? "" : "AND r.deleted_at IS NULL"}
      ${!publico && !moderador ? "AND r.usuario_id = ?" : ""}
      ORDER BY m.ordem, m.id`, !publico && !moderador ? [publicId, autorId] : [publicId]);
    if (!linhas.length) return null;
    return linhas.filter(linha => linha.id != null);
  }
  return { listar };
}
module.exports = { ...criarMidiaModel(), criarMidiaModel };
