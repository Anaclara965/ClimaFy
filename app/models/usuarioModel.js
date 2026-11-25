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
      `SELECT ${CAMPOS_USUARIO},
              EXISTS(
                SELECT 1 FROM usuarios foto
                 WHERE foto.id = u.id AND foto.deleted_at IS NULL
                   AND foto.foto_perfil_chave IS NOT NULL
              ) AS tem_foto_perfil
         FROM usuarios u
         JOIN papeis p ON p.id = u.papel_id
        WHERE u.email = ? AND u.deleted_at IS NULL
        LIMIT 1`,
      [normalizarEmail(email)]
    );
    return linhas[0] ?? null;
  }

  async function buscarPorId(id, conexao = pool) {
    const [linhas] = await conexao.query(
      `SELECT ${CAMPOS_USUARIO}
         FROM usuarios u
         JOIN papeis p ON p.id = u.papel_id
        WHERE u.id = ? AND u.deleted_at IS NULL
        LIMIT 1`,
      [id]
    );
    return linhas[0] ?? null;
  }

  async function buscarPerfilPorId(id) {
    const [linhas] = await pool.query(
      `SELECT u.id, u.nome, u.sobrenome, u.email, u.email_pendente, u.telefone,
              u.foto_perfil_chave, u.foto_perfil_mime_type, u.foto_perfil_tamanho_bytes,
              p.codigo AS papel
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

      const usuario = await buscarPorId(resultado.insertId, conexao);
      await conexao.commit();
      return usuario;
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

  async function atualizarPerfil(usuarioId, { nome, sobrenome, telefone }) {
    await pool.query(
      "UPDATE usuarios SET nome = ?, sobrenome = ?, telefone = ? WHERE id = ? AND deleted_at IS NULL",
      [nome, sobrenome, telefone, usuarioId]
    );
  }

  async function atualizarFotoPerfil(usuarioId, foto) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const [linhas] = await conexao.query(
        `SELECT foto_perfil_chave, foto_perfil_mime_type, foto_perfil_tamanho_bytes
           FROM usuarios WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
        [usuarioId]
      );
      if (!linhas[0]) throw Object.assign(new Error("Conta não encontrada."), { status: 404, previsto: true });
      await conexao.query(
        `UPDATE usuarios SET foto_perfil_chave = ?, foto_perfil_mime_type = ?,
                foto_perfil_tamanho_bytes = ?
          WHERE id = ? AND deleted_at IS NULL`,
        [foto.chave_arquivo, foto.mime_type, foto.tamanho_bytes, usuarioId]
      );
      await conexao.commit();
      return linhas[0];
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  async function limparFotoPerfil(usuarioId) {
    const [resultado] = await pool.query(
      `UPDATE usuarios SET foto_perfil_chave = NULL, foto_perfil_mime_type = NULL,
              foto_perfil_tamanho_bytes = NULL
        WHERE id = ? AND deleted_at IS NULL`,
      [usuarioId]
    );
    return resultado.affectedRows === 1;
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
    buscarPerfilPorId,
    emailJaExiste,
    criarUsuario,
    marcarEmailVerificado,
    registrarAcesso,
    atualizarSenha,
    atualizarPerfil,
    atualizarFotoPerfil,
    limparFotoPerfil,
    listarUsuarios,
    definirStatus,
  };
}

module.exports = { ...criarUsuarioModel(), criarUsuarioModel, normalizarEmail, PAPEL_PADRAO };
