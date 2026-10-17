const poolPadrao = require("../config/db");
const { compararCodigo, codigoTemFormatoValido, MAX_TENTATIVAS } = require("../helpers/codigoVerificacao");

function criarRecuperacaoSenhaModel(pool = poolPadrao) {
  // A trava por conta serializa pedidos e confirmações, inclusive entre processos.
  async function transacao(operacao) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const resultado = await operacao(conexao);
      await conexao.commit();
      return resultado;
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  async function buscarConta(conexao, email) {
    const [usuarios] = await conexao.query(
      `SELECT id, email, status, deleted_at FROM usuarios WHERE email = ? LIMIT 1 FOR UPDATE`,
      [email]
    );
    const usuario = usuarios[0];
    return usuario?.status === "ativo" && !usuario.deleted_at ? usuario : null;
  }

  async function emitirCodigo({ email, codigoHash, expiraEm }) {
    return transacao(async conexao => {
      const usuario = await buscarConta(conexao, email);
      if (!usuario) return null;
      const [contagens] = await conexao.query(
        `SELECT COUNT(*) AS hora,
                COALESCE(SUM(created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 60 SECOND)), 0) AS minuto
           FROM codigos_verificacao_email
          WHERE usuario_id = ? AND finalidade = 'recuperacao_senha'
            AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)`,
        [usuario.id]
      );
      // Não invalida o código atual quando o pedido está limitado.
      if (Number(contagens[0].minuto) > 0 || Number(contagens[0].hora) >= 5) return null;
      await conexao.query(
        `UPDATE codigos_verificacao_email SET consumido_em = UTC_TIMESTAMP()
          WHERE usuario_id = ? AND finalidade = 'recuperacao_senha' AND consumido_em IS NULL`,
        [usuario.id]
      );
      await conexao.query(
        `INSERT INTO codigos_verificacao_email (usuario_id, codigo_hash, finalidade, expira_em)
         VALUES (?, ?, 'recuperacao_senha', ?)`,
        [usuario.id, codigoHash, expiraEm]
      );
      return { usuarioId: usuario.id, email: usuario.email };
    });
  }

  async function redefinirSenha({ email, codigo, senhaHash }) {
    if (typeof codigo !== "string" || !codigoTemFormatoValido(codigo)) return { ok: false };
    return transacao(async conexao => {
      const usuario = await buscarConta(conexao, email);
      if (!usuario) return { ok: false };
      const [codigos] = await conexao.query(
        `SELECT id, codigo_hash, tentativas, (expira_em <= UTC_TIMESTAMP()) AS expirado
           FROM codigos_verificacao_email
          WHERE usuario_id = ? AND finalidade = 'recuperacao_senha' AND consumido_em IS NULL
          ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [usuario.id]
      );
      const registro = codigos[0];
      if (!registro) return { ok: false };
      const consumir = async () => {
        const [resultado] = await conexao.query(
          `UPDATE codigos_verificacao_email SET consumido_em = UTC_TIMESTAMP()
            WHERE id = ? AND consumido_em IS NULL`, [registro.id]
        );
        if (resultado.affectedRows !== 1) throw new Error("Falha ao consumir código de recuperação.");
      };
      if (Number(registro.expirado) || Number(registro.tentativas) >= MAX_TENTATIVAS) {
        await consumir();
        return { ok: false };
      }
      if (!compararCodigo(codigo, registro.codigo_hash)) {
        await conexao.query(
          "UPDATE codigos_verificacao_email SET tentativas = tentativas + 1 WHERE id = ?", [registro.id]
        );
        if (Number(registro.tentativas) + 1 >= MAX_TENTATIVAS) await consumir();
        return { ok: false };
      }
      // Consumo e troca são atômicos. Não ativa e-mail, desbloqueia ou muda papel.
      await consumir();
      const [resultado] = await conexao.query(
        `UPDATE usuarios SET senha_hash = ?
          WHERE id = ? AND status = 'ativo' AND deleted_at IS NULL`, [senhaHash, usuario.id]
      );
      if (resultado.affectedRows !== 1) throw new Error("Falha ao redefinir senha.");
      return { ok: true };
    });
  }

  return { emitirCodigo, redefinirSenha };
}

module.exports = { ...criarRecuperacaoSenhaModel(), criarRecuperacaoSenhaModel };
