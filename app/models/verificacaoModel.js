// Acesso a codigos_verificacao_email (OTP de cadastro, troca de e-mail e
// recuperacao de senha). O banco guarda so o hash (CHAR(64)).
const poolPadrao = require("../config/db");
const {
  compararCodigo,
  codigoTemFormatoValido,
  MAX_TENTATIVAS,
} = require("../helpers/codigoVerificacao");

function criarVerificacaoModel(pool = poolPadrao) {
  // Um novo codigo invalida os anteriores da mesma finalidade: evita dois
  // codigos validos ao mesmo tempo.
  async function criarCodigo({ usuarioId, codigoHash, finalidade, expiraEm }) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();

      // Criacao e confirmacao usam a mesma trava por conta. Um reenvio nao
      // invalida o codigo enquanto outra transacao esta conferindo esse codigo.
      await conexao.query("SELECT id FROM usuarios WHERE id = ? FOR UPDATE", [usuarioId]);

      await conexao.query(
        `UPDATE codigos_verificacao_email
            SET consumido_em = UTC_TIMESTAMP()
          WHERE usuario_id = ? AND finalidade = ? AND consumido_em IS NULL`,
        [usuarioId, finalidade]
      );

      const [resultado] = await conexao.query(
        `INSERT INTO codigos_verificacao_email
           (usuario_id, codigo_hash, finalidade, expira_em)
         VALUES (?, ?, ?, ?)`,
        [usuarioId, codigoHash, finalidade, expiraEm]
      );

      await conexao.commit();
      return resultado.insertId;
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  // Ultimo codigo ainda nao consumido (a validacao de expiracao e do controller).
  async function buscarPendente(usuarioId, finalidade) {
    const [linhas] = await pool.query(
      `SELECT id, usuario_id, codigo_hash, finalidade, expira_em, tentativas
         FROM codigos_verificacao_email
        WHERE usuario_id = ? AND finalidade = ? AND consumido_em IS NULL
        ORDER BY id DESC
        LIMIT 1`,
      [usuarioId, finalidade]
    );
    return linhas[0] ?? null;
  }

  // Confere, conta tentativas, consome o codigo e ativa a conta na mesma
  // transacao. FOR UPDATE faz outra confirmacao da mesma conta esperar.
  async function confirmarCadastro({ usuarioId, codigo }) {
    if (typeof codigo !== "string" || !codigoTemFormatoValido(codigo)) {
      return { ok: false, motivo: "formato" };
    }

    const conexao = await pool.getConnection();
    async function concluir(resultado) {
      await conexao.commit();
      return resultado;
    }
    async function consumirNaTransacao(id) {
      const [resultado] = await conexao.query(
        `UPDATE codigos_verificacao_email SET consumido_em = UTC_TIMESTAMP()
          WHERE id = ? AND consumido_em IS NULL`,
        [id]
      );
      if (resultado.affectedRows !== 1) throw new Error("Codigo nao pode ser consumido.");
    }

    try {
      await conexao.beginTransaction();
      const [usuarios] = await conexao.query(
        `SELECT id, status, email_verificado_em, deleted_at
           FROM usuarios WHERE id = ? FOR UPDATE`,
        [usuarioId]
      );
      const usuario = usuarios[0];
      if (!usuario || usuario.status !== "ativo" || usuario.deleted_at) {
        return await concluir({ ok: false, motivo: "conta_indisponivel" });
      }
      if (usuario.email_verificado_em) {
        return await concluir({ ok: false, motivo: "ja_verificado" });
      }

      const [codigos] = await conexao.query(
        `SELECT id, codigo_hash, tentativas,
                (expira_em <= UTC_TIMESTAMP()) AS expirado
           FROM codigos_verificacao_email
          WHERE usuario_id = ? AND finalidade = 'cadastro' AND consumido_em IS NULL
          ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [usuarioId]
      );
      const pendente = codigos[0];
      if (!pendente) return await concluir({ ok: false, motivo: "sem_codigo" });

      // Usa o relogio do banco para a decisao, nunca o temporizador da pagina.
      if (Number(pendente.expirado)) {
        await consumirNaTransacao(pendente.id);
        return await concluir({ ok: false, motivo: "expirado" });
      }
      if (Number(pendente.tentativas) >= MAX_TENTATIVAS) {
        await consumirNaTransacao(pendente.id);
        return await concluir({ ok: false, motivo: "tentativas", restantes: 0 });
      }

      if (!compararCodigo(codigo, pendente.codigo_hash)) {
        const restantes = MAX_TENTATIVAS - Number(pendente.tentativas) - 1;
        await conexao.query(
          "UPDATE codigos_verificacao_email SET tentativas = tentativas + 1 WHERE id = ?",
          [pendente.id]
        );
        if (restantes === 0) await consumirNaTransacao(pendente.id);
        return await concluir({
          ok: false, motivo: restantes === 0 ? "tentativas" : "incorreto", restantes,
        });
      }

      await consumirNaTransacao(pendente.id);
      const [ativacao] = await conexao.query(
        `UPDATE usuarios SET email_verificado_em = UTC_TIMESTAMP()
          WHERE id = ? AND email_verificado_em IS NULL
            AND status = 'ativo' AND deleted_at IS NULL`,
        [usuarioId]
      );
      if (ativacao.affectedRows !== 1) throw new Error("Conta nao pode ser verificada.");
      return await concluir({ ok: true });
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  async function incrementarTentativas(codigoId) {
    await pool.query(
      "UPDATE codigos_verificacao_email SET tentativas = tentativas + 1 WHERE id = ?",
      [codigoId]
    );
  }

  async function consumir(codigoId) {
    await pool.query(
      `UPDATE codigos_verificacao_email
          SET consumido_em = UTC_TIMESTAMP()
        WHERE id = ? AND consumido_em IS NULL`,
      [codigoId]
    );
  }

  // Base do 429 do reenvio: quantos codigos foram pedidos nos ultimos N segundos.
  async function contarEnviosRecentes(usuarioId, finalidade, segundos) {
    const [linhas] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM codigos_verificacao_email
        WHERE usuario_id = ?
          AND finalidade = ?
          AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND)`,
      [usuarioId, finalidade, Number(segundos) || 60]
    );
    return Number(linhas[0]?.total ?? 0);
  }

  // Usado pela rotina de limpeza (cosmetico: o dado e transitorio).
  async function apagarExpirados() {
    const [resultado] = await pool.query(
      `DELETE FROM codigos_verificacao_email
        WHERE expira_em < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)`
    );
    return resultado.affectedRows;
  }

  return {
    criarCodigo,
    buscarPendente,
    confirmarCadastro,
    incrementarTentativas,
    consumir,
    contarEnviosRecentes,
    apagarExpirados,
  };
}

module.exports = { ...criarVerificacaoModel(), criarVerificacaoModel };
