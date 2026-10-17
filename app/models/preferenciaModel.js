// Preferencias do usuario: bairros acompanhados (N:N), categorias de interesse
// (N:N) e frequencia de notificacao (1:1). Substitui a lista hardcoded de 8
// bairros que existia em app/public/js/cadastro-preferencias.js.
const poolPadrao = require("../config/db");

const FREQUENCIAS = ["imediato", "diario", "semanal"];
const FREQUENCIA_PADRAO = "diario";

function criarPreferenciaModel(pool = poolPadrao) {
  async function idsDeCategoriasPorSlug(slugs, conexao = pool) {
    const lista = [...new Set((slugs ?? []).map((slug) => String(slug).trim()).filter(Boolean))];
    if (!lista.length) return [];

    const [linhas] = await conexao.query(
      "SELECT id FROM categorias_ocorrencia WHERE slug IN (?) AND ativo = 1",
      [lista]
    );
    return linhas.map((linha) => linha.id);
  }

  // Sempre substitui o conjunto inteiro (delete + insert): simples de entender
  // e idempotente quando o usuario salva a tela duas vezes.
  async function salvarPreferencias(usuarioId, { bairroIds = [], categoriaSlugs = [], frequencia } = {}) {
    const bairros = [...new Set((bairroIds ?? []).map(Number).filter(Number.isInteger))];
    const frequenciaSegura = FREQUENCIAS.includes(frequencia) ? frequencia : FREQUENCIA_PADRAO;

    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();

      const categoriaIds = await idsDeCategoriasPorSlug(categoriaSlugs, conexao);

      await conexao.query("DELETE FROM preferencias_bairros WHERE usuario_id = ?", [usuarioId]);
      await conexao.query("DELETE FROM preferencias_categorias WHERE usuario_id = ?", [usuarioId]);

      if (bairros.length) {
        // INSERT ... SELECT cruza com bairros: id inexistente simplesmente nao entra.
        await conexao.query(
          `INSERT INTO preferencias_bairros (usuario_id, bairro_id)
           SELECT ?, b.id FROM bairros b WHERE b.id IN (?) AND b.ativo = 1`,
          [usuarioId, bairros]
        );
      }

      if (categoriaIds.length) {
        await conexao.query(
          `INSERT INTO preferencias_categorias (usuario_id, categoria_id)
           SELECT ?, c.id FROM categorias_ocorrencia c WHERE c.id IN (?)`,
          [usuarioId, categoriaIds]
        );
      }

      await conexao.query(
        `INSERT INTO preferencias_notificacao (usuario_id, frequencia)
         VALUES (?, ?) AS novo
         ON DUPLICATE KEY UPDATE frequencia = novo.frequencia`,
        [usuarioId, frequenciaSegura]
      );

      await conexao.commit();
      return { bairros: bairros.length, categorias: categoriaIds.length, frequencia: frequenciaSegura };
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  async function listarPreferencias(usuarioId) {
    const [bairros] = await pool.query(
      `SELECT b.id, b.nome, c.nome AS cidade
         FROM preferencias_bairros pb
         JOIN bairros b ON b.id = pb.bairro_id
         JOIN cidades c ON c.id = b.cidade_id
        WHERE pb.usuario_id = ?
        ORDER BY b.nome`,
      [usuarioId]
    );

    const [categorias] = await pool.query(
      `SELECT co.id, co.slug, co.nome
         FROM preferencias_categorias pc
         JOIN categorias_ocorrencia co ON co.id = pc.categoria_id
        WHERE pc.usuario_id = ?
        ORDER BY co.ordem_exibicao`,
      [usuarioId]
    );

    const [notificacao] = await pool.query(
      "SELECT frequencia FROM preferencias_notificacao WHERE usuario_id = ? LIMIT 1",
      [usuarioId]
    );

    return {
      bairros,
      categorias,
      frequencia: notificacao[0]?.frequencia ?? FREQUENCIA_PADRAO,
    };
  }

  // Primeiro login decide o destino: sem preferencia ainda -> /cadastro-preferencias.
  async function temPreferencias(usuarioId) {
    const [linhas] = await pool.query(
      `SELECT 1 AS existe
         FROM preferencias_bairros
        WHERE usuario_id = ?
        LIMIT 1`,
      [usuarioId]
    );
    return linhas.length > 0;
  }

  return { salvarPreferencias, listarPreferencias, temPreferencias };
}

module.exports = { ...criarPreferenciaModel(), criarPreferenciaModel, FREQUENCIAS };
