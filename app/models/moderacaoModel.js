const poolPadrao = require("../config/db");
const { apresentar, ultimaModeracao, campos, joins } = require("./relatoConsultaModel");
const notificacoes = require("./notificacaoModel");

function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status, previsto: true }); }

function criarModeracaoModel(pool = poolPadrao) {
  async function listar({ pagina = 1, limite = 12, decisao = "pendente", busca = "", ordem = "oldest" } = {}) {
    const filtros = ["r.deleted_at IS NULL"];
    const valores = [];
    if (decisao === "pendente") filtros.push("m.id IS NULL");
    else if (decisao !== "todos") { filtros.push("m.decisao = ?"); valores.push(decisao); }
    if (busca) {
      filtros.push("(r.titulo LIKE ? ESCAPE '!' OR r.descricao LIKE ? ESCAPE '!' OR b.nome LIKE ? ESCAPE '!')");
      const termo = `%${busca.replace(/[!%_]/g, "!$&")}%`; valores.push(termo, termo, termo);
    }
    const base = `FROM relatos r ${joins} ${ultimaModeracao} WHERE ${filtros.join(" AND ")}`;
    const [linhas] = await pool.query(`SELECT ${campos}, m.decisao, m.id AS revisao,
      (SELECT nome FROM usuarios WHERE id = r.usuario_id) AS autor ${base}
      ORDER BY r.created_at ${ordem === "newest" ? "DESC" : "ASC"}, r.id ${ordem === "newest" ? "DESC" : "ASC"}
      LIMIT ? OFFSET ?`, [...valores, limite, (pagina - 1) * limite]);
    const [[contagem]] = await pool.query(`SELECT COUNT(*) AS total ${base}`, valores);
    const [[resumo]] = await pool.query(`SELECT COUNT(*) AS total,
      COALESCE(SUM(m.id IS NULL), 0) AS pendentes,
      COALESCE(SUM(m.decisao = 'aprovado'), 0) AS aprovados,
      COALESCE(SUM(m.decisao = 'rejeitado'), 0) AS rejeitados,
      COALESCE(SUM(m.decisao = 'solicitado_ajuste'), 0) AS ajuste
      FROM relatos r ${ultimaModeracao} WHERE r.deleted_at IS NULL`);
    const [motivos] = await pool.query("SELECT codigo, titulo FROM motivos_moderacao WHERE ativo = 1 ORDER BY titulo");
    const total = Number(contagem.total);
    return { relatos: linhas.map(apresentar), resumo: Object.fromEntries(Object.entries(resumo).map(([chave, valor]) => [chave, Number(valor)])), motivos,
      paginacao: { pagina, limite, total, paginas: Math.ceil(total / limite) } };
  }

  // Bloqueio + revisao esperada evitam que dois moderadores sobrescrevam decisoes.
  async function alterar({ publicId, moderadorId, decisao, revisao, motivo, observacao,
    situacao, statusAnterior, versao }) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const [usuarios] = await conexao.query(`SELECT u.id FROM usuarios u
        JOIN papeis p ON p.id = u.papel_id WHERE u.id = ?
        AND p.codigo IN ('moderador', 'administrador') AND u.status = 'ativo'
        AND u.deleted_at IS NULL AND u.email_verificado_em IS NOT NULL FOR UPDATE`, [moderadorId]);
      if (!usuarios.length) throw erro("Seu perfil não tem permissão para moderar.", 403);
      const [relatos] = await conexao.query(`SELECT id, usuario_id, titulo, status, versao_conteudo FROM relatos
        WHERE public_id = ? AND deleted_at IS NULL FOR UPDATE`, [publicId]);
      if (!relatos.length) throw erro("Relato não encontrado.", 404);
      const relato = relatos[0];
      if (String(relato.versao_conteudo) !== versao) {
        throw erro("O conteúdo foi editado. Atualize e confira a nova versão antes de moderar.", 409);
      }
      if (situacao !== undefined) {
        if (relato.status !== statusAnterior) throw erro("A situação mudou. Atualize a página antes de continuar.", 409);
        if (relato.status !== situacao) {
          await conexao.query(`UPDATE relatos SET status = ?,
            resolvido_em = CASE WHEN ? = 'resolvido' THEN UTC_TIMESTAMP() ELSE NULL END WHERE id = ?`,
            [situacao, situacao, relato.id]);
          await conexao.query(`INSERT INTO historico_status_relato
            (relato_id, status_anterior, status_novo, alterado_por_usuario_id, observacao)
            VALUES (?, ?, ?, ?, ?)`, [relato.id, relato.status, situacao, moderadorId, observacao || null]);
          await notificacoes.registrarAtualizacao(conexao, { usuarioId: relato.usuario_id, tituloRelato: relato.titulo,
            versao, situacao, statusAnterior: relato.status });
        }
      } else {
        const [ultimas] = await conexao.query(`SELECT id FROM moderacoes_relato WHERE relato_id = ? AND versao_conteudo = ?
          ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`, [relato.id, versao]);
        if (String(ultimas[0]?.id || 0) !== String(revisao)) {
          throw erro("Este relato já foi revisado. Atualize a lista antes de continuar.", 409);
        }
        let motivoId = null;
        if (decisao !== "aprovado") {
          const [motivos] = await conexao.query("SELECT id FROM motivos_moderacao WHERE codigo = ? AND ativo = 1 LIMIT 1", [motivo]);
          if (!motivos.length) throw erro("Selecione um motivo de moderação válido.", 422);
          motivoId = motivos[0].id;
        }
        await conexao.query(`INSERT INTO moderacoes_relato
          (relato_id, moderador_id, decisao, motivo_id, observacao, versao_conteudo) VALUES (?, ?, ?, ?, ?, ?)`,
          [relato.id, moderadorId, decisao, motivoId, observacao || null, versao]);
        await notificacoes.registrarAtualizacao(conexao, { usuarioId: relato.usuario_id, tituloRelato: relato.titulo, versao, decisao });
      }
      await conexao.commit();
      return { ok: true, mensagem: situacao !== undefined ? "Situação atualizada." : "Decisão de moderação salva." };
    } catch (falha) { await conexao.rollback(); throw falha; }
    finally { conexao.release(); }
  }
  return { listar, alterar };
}
module.exports = { ...criarModeracaoModel(), criarModeracaoModel };
