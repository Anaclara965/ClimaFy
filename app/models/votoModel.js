const poolPadrao = require("../config/db");

function erro(mensagem, status) {
  return Object.assign(new Error(mensagem), { status, previsto: true });
}

function apresentarVoto(registro) {
  const proprio = Boolean(Number(registro.proprio));
  return { publicId: registro.public_id, votos: Number(registro.votos),
    votado: Boolean(Number(registro.votado)), proprio, podeVotar: !proprio };
}

function criarVotoModel(pool = poolPadrao) {
  // Estado privado em lote: não põe identidade/token na resposta pública cacheável.
  async function consultar({ publicIds, usuarioId }) {
    const marcadores = publicIds.map(() => "?").join(", ");
    const [linhas] = await pool.query(
      `SELECT r.public_id, (r.usuario_id = ?) AS proprio,
              EXISTS(SELECT 1 FROM relato_votos v WHERE v.relato_id = r.id AND v.usuario_id = ?) AS votado,
              (SELECT COUNT(*) FROM relato_votos v WHERE v.relato_id = r.id) AS votos
         FROM vw_relatos_publicos r WHERE r.public_id IN (${marcadores})`,
      [usuarioId, usuarioId, ...publicIds]
    );
    return linhas.map(apresentarVoto);
  }

  // PUT define "votado", DELETE define "não votado"; não é um toggle no servidor.
  // Repetir a mesma operação (inclusive após falha de rede) é seguro.
  async function definir({ publicId, usuarioId, votar }) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const [usuarios] = await conexao.query(
        `SELECT id FROM usuarios WHERE id = ? AND status = 'ativo'
          AND email_verificado_em IS NOT NULL AND deleted_at IS NULL FOR UPDATE`, [usuarioId]
      );
      if (!usuarios.length) throw erro("Sua conta não pode realizar esta ação.", 403);
      // Mesma ordem de travas da moderação: usuário → relato.
      const [relatos] = await conexao.query(
        `SELECT id, usuario_id FROM relatos WHERE public_id = ? AND deleted_at IS NULL FOR UPDATE`, [publicId]
      );
      const relato = relatos[0];
      if (!relato) throw erro("Relato não encontrado.", 404);
      // Primeira leitura de snapshot só DEPOIS da trava: vê a publicação vigente.
      // A moderação também trava o relato antes de gravar uma nova decisão.
      const [publicados] = await conexao.query("SELECT id FROM vw_relatos_publicos WHERE id = ?", [relato.id]);
      if (!publicados.length) throw erro("Relato não encontrado.", 404);
      if (String(relato.usuario_id) === String(usuarioId)) throw erro("Você não pode votar no próprio relato.", 403);

      if (votar) {
        const [existentes] = await conexao.query(
          "SELECT usuario_id FROM relato_votos WHERE relato_id = ? AND usuario_id = ?", [relato.id, usuarioId]
        );
        if (!existentes.length) await conexao.query(
          "INSERT INTO relato_votos (relato_id, usuario_id) VALUES (?, ?)", [relato.id, usuarioId]
        );
      } else {
        await conexao.query("DELETE FROM relato_votos WHERE relato_id = ? AND usuario_id = ?", [relato.id, usuarioId]);
      }
      const [[contagem]] = await conexao.query("SELECT COUNT(*) AS votos FROM relato_votos WHERE relato_id = ?", [relato.id]);
      await conexao.commit();
      return { publicId, votos: Number(contagem.votos), votado: votar, proprio: false, podeVotar: true };
    } catch (falha) {
      await conexao.rollback();
      throw falha;
    } finally { conexao.release(); }
  }

  return { consultar, definir };
}

module.exports = { ...criarVotoModel(), criarVotoModel };
