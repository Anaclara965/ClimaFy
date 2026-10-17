// Acesso a tabela usuarios. Unico lugar do projeto com SQL de usuario.
// O pool pode ser injetado (criarUsuarioModel(poolFalso)) para os testes rodarem
// sem banco de dados.
const poolPadrao = require("../config/db");

const PAPEL_PADRAO = "cidadao";

// E-mails sao comparados em minusculas (uk_usuarios_email no schema).
function normalizarEmail(email = "") {
  return String(email).trim().toLowerCase();
}

const CAMPOS_USUARIO = `
  u.id,
  u.public_id,
  u.nome,
  u.sobrenome,
  u.email,
  u.senha_hash,
  u.status,
  u.email_verificado_em,
  u.ultimo_acesso_em,
  u.created_at,
  p.codigo AS papel
`;

function criarUsuarioModel(pool = poolPadrao) {
  async function buscarPapelId(codigo, conexao = pool) {
    const [linhas] = await conexao.query(
      "SELECT id FROM papeis WHERE codigo = ? LIMIT 1",
      [codigo]
    );
    if (!linhas.length) {
      throw new Error(`Papel "${codigo}" nao encontrado. Rode npm run db:schema.`);
    }
    return linhas[0].id;
  }

  async function buscarPorEmail(email) {
    const [linhas] = await pool.query(
      `SELECT ${CAMPOS_USUARIO}
         FROM usuarios u
         JOIN papeis p ON p.id = u.papel_id
        WHERE u.email = ? AND u.deleted_at IS NULL
        LIMIT 1`,
      [normalizarEmail(email)]
    );
    return linhas[0] ?? null;
  }

  async function buscarPorId(id) {
    const [linhas] = await pool.query(
      `SELECT ${CAMPOS_USUARIO}
         FROM usuarios u
         JOIN papeis p ON p.id = u.papel_id
        WHERE u.id = ? AND u.deleted_at IS NULL
        LIMIT 1`,
      [id]
    );
    return linhas[0] ?? null;
  }

  async function emailJaExiste(email) {
    const usuario = await buscarPorEmail(email);
    return usuario !== null;
  }

  // Cria a conta e registra o aceite dos documentos legais ativos na MESMA
  // transacao: ou as duas coisas acontecem, ou nenhuma.
  async function criarUsuario({
    nome,
    sobrenome,
    email,
    senhaHash,
    papel = PAPEL_PADRAO,
    ipHash = null,
    userAgent = null,
  }) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const papelId = await buscarPapelId(papel, conexao);

      const [resultado] = await conexao.query(
        `INSERT INTO usuarios (papel_id, nome, sobrenome, email, senha_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [papelId, nome, sobrenome, normalizarEmail(email), senhaHash]
      );

      // Aceite versionado: uma linha por documento legal ativo (termos + privacidade).
      await conexao.query(
        `INSERT INTO consentimentos_usuario (usuario_id, documento_legal_id, ip_hash, user_agent)
         SELECT ?, d.id, ?, ?
           FROM documentos_legais d
          WHERE d.ativo = 1`,
        [resultado.insertId, ipHash, userAgent ? String(userAgent).slice(0, 255) : null]
      );

      await conexao.commit();
      return buscarPorId(resultado.insertId);
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  // Chamado SO depois que o servidor conferiu o codigo enviado por e-mail.
  async function marcarEmailVerificado(usuarioId) {
    await pool.query(
      `UPDATE usuarios
          SET email_verificado_em = UTC_TIMESTAMP()
        WHERE id = ? AND email_verificado_em IS NULL`,
      [usuarioId]
    );
  }

  async function registrarAcesso(usuarioId) {
    await pool.query(
      "UPDATE usuarios SET ultimo_acesso_em = UTC_TIMESTAMP() WHERE id = ?",
      [usuarioId]
    );
  }

  // Usado pelo fluxo de recuperacao de senha.
  async function atualizarSenha(usuarioId, senhaHash) {
    await pool.query("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [
      senhaHash,
      usuarioId,
    ]);
  }

  // Painel administrativo: lista com busca por nome/e-mail e filtro por papel/status.
  async function listarUsuarios({ busca = "", papel = null, status = null, limite = 50 } = {}) {
    const filtros = ["u.deleted_at IS NULL"];
    const valores = [];
    const termo = String(busca).trim();

    if (termo) {
      filtros.push("(u.nome LIKE ? OR u.sobrenome LIKE ? OR u.email LIKE ?)");
      valores.push(`%${termo}%`, `%${termo}%`, `%${termo}%`);
    }
    if (papel) {
      filtros.push("p.codigo = ?");
      valores.push(papel);
    }
    if (status) {
      filtros.push("u.status = ?");
      valores.push(status);
    }

    valores.push(Number(limite) || 50);

    const [linhas] = await pool.query(
      `SELECT ${CAMPOS_USUARIO}
         FROM usuarios u
         JOIN papeis p ON p.id = u.papel_id
        WHERE ${filtros.join(" AND ")}
        ORDER BY u.created_at DESC
        LIMIT ?`,
      valores
    );
    return linhas;
  }

  async function definirStatus(usuarioId, status) {
    await pool.query("UPDATE usuarios SET status = ? WHERE id = ?", [status, usuarioId]);
  }

  return {
    buscarPorEmail,
    buscarPorId,
    emailJaExiste,
    criarUsuario,
    marcarEmailVerificado,
    registrarAcesso,
    atualizarSenha,
    listarUsuarios,
    definirStatus,
  };
}

module.exports = { ...criarUsuarioModel(), criarUsuarioModel, normalizarEmail, PAPEL_PADRAO };
