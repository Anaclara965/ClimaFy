const poolPadrao = require("../config/db");
const { ultimaModeracao } = require("./relatoConsultaModel");
const { periodosAdmin } = require("../helpers/periodosAdmin");
const CAMPOS = `u.public_id, u.nome, u.sobrenome, u.email, u.status, u.created_at,
  u.email_verificado_em, p.codigo AS papel,
  (SELECT COUNT(*) FROM relatos r WHERE r.usuario_id = u.id AND r.deleted_at IS NULL) AS relatos`;
function apresentarUsuario(u) {
  return { publicId: u.public_id, nome: u.nome, sobrenome: u.sobrenome, email: u.email,
    papel: u.papel, status: u.status, emailVerificado: Boolean(u.email_verificado_em),
    criadoEm: u.created_at, relatos: Number(u.relatos),
    podeAlterarStatus: ["cidadao", "moderador"].includes(u.papel) && ["ativo", "bloqueado"].includes(u.status) };
}
function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status, previsto: true }); }
function numeros(objeto) { return Object.fromEntries(Object.entries(objeto).map(([chave, valor]) => [chave, Number(valor)])); }

function criarAdminModel(pool = poolPadrao, relogio = () => new Date()) {
  // Leituras de cada painel compartilham um snapshot; não exibem metades de uma mudança.
  async function consultar(operacao) {
    const c = await pool.getConnection();
    try {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      await c.beginTransaction();
      const resultado = await operacao(c);
      await c.commit(); return resultado;
    } catch (falha) { await c.rollback(); throw falha; }
    finally { c.release(); }
  }

  async function listarUsuarios({ busca = "", status, papel, pagina = 1, limite = 20 } = {}) {
    const periodo = periodosAdmin(relogio());
    return consultar(async c => {
      const where = ["u.deleted_at IS NULL"], valores = [];
      if (busca) {
        where.push("(u.nome LIKE ? ESCAPE '!' OR u.sobrenome LIKE ? ESCAPE '!' OR u.email LIKE ? ESCAPE '!' OR p.codigo LIKE ? ESCAPE '!' OR u.public_id = ?)");
        const termo = "%" + busca.replace(/[!%_]/g, "!$&") + "%";
        valores.push(termo, termo, termo, termo, busca);
      }
      if (status === "pendente") where.push("u.status = 'ativo' AND u.email_verificado_em IS NULL");
      else if (status === "ativo") where.push("u.status = 'ativo' AND u.email_verificado_em IS NOT NULL");
      else if (status) { where.push("u.status = ?"); valores.push(status); }
      if (papel) { where.push("p.codigo = ?"); valores.push(papel); }
      const base = `FROM usuarios u JOIN papeis p ON p.id = u.papel_id WHERE ${where.join(" AND ")}`;
      const [linhas] = await c.query(`SELECT ${CAMPOS} ${base} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
        [...valores, limite, (pagina - 1) * limite]);
      const [[contagem]] = await c.query(`SELECT COUNT(*) AS total ${base}`, valores);
      const [[resumo]] = await c.query(`SELECT COUNT(*) AS total,
        COALESCE(SUM(status = 'ativo' AND email_verificado_em IS NOT NULL), 0) AS ativos,
        COALESCE(SUM(status = 'ativo' AND email_verificado_em IS NULL), 0) AS pendentes,
        COALESCE(SUM(status = 'bloqueado'), 0) AS bloqueados,
        COALESCE(SUM(status = 'inativo'), 0) AS inativos,
        COALESCE(SUM(created_at >= ? AND created_at <= ?), 0) AS novosMes,
        COALESCE(SUM(created_at >= ? AND created_at <= ?), 0) AS novosSemana,
        COALESCE(SUM(created_at >= ? AND created_at < ?), 0) AS novosSemanaAnterior
        FROM usuarios WHERE deleted_at IS NULL`, [periodo.inicioMes, periodo.agora, periodo.inicioSemana, periodo.agora,
        periodo.inicioSemanaAnterior, periodo.inicioSemana]);
      const total = Number(contagem.total);
      return { usuarios: linhas.map(apresentarUsuario), resumo: numeros(resumo),
        paginacao: { pagina, limite, total, paginas: Math.ceil(total / limite) } };
    });
  }

  async function alterarStatus({ publicId, administradorId, status, statusAnterior }) {
    if (!["ativo", "bloqueado"].includes(status) || !["ativo", "bloqueado"].includes(statusAnterior)) throw erro("Transição de status inválida.", 422);
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      // Administradores nunca são alvos deste endpoint (evita auto/último-admin bloqueado).
      const [alvos] = await c.query(`SELECT u.id, p.codigo AS papel FROM usuarios u JOIN papeis p ON p.id = u.papel_id
        WHERE u.public_id = ? AND u.deleted_at IS NULL LIMIT 1`, [publicId]);
      const alvo = alvos[0];
      if (!alvo) throw erro("Usuário não encontrado.", 404);
      if (alvo.papel === "administrador" || String(alvo.id) === String(administradorId)) {
        throw erro("Não é permitido alterar o status da própria conta ou de uma conta de administrador neste painel.", 403);
      }
      const [atores] = await c.query(`SELECT u.id FROM usuarios u JOIN papeis p ON p.id = u.papel_id
        WHERE u.id = ? AND p.codigo IN ('moderador', 'administrador') AND u.status = 'ativo'
        AND u.email_verificado_em IS NOT NULL AND u.deleted_at IS NULL FOR UPDATE`, [administradorId]);
      if (!atores.length) throw erro("Seu perfil não tem permissão para esta ação.", 403);
      const [atuais] = await c.query(`SELECT u.id, u.status, u.email_verificado_em FROM usuarios u
        JOIN papeis p ON p.id = u.papel_id WHERE u.id = ? AND u.deleted_at IS NULL
        AND p.codigo IN ('cidadao', 'moderador') FOR UPDATE`, [alvo.id]);
      const atual = atuais[0];
      if (!atual) throw erro("Usuário não está disponível para esta ação.", 404);
      if (!["ativo", "bloqueado"].includes(atual.status)) throw erro("Uma conta inativa não pode ser reativada por este fluxo.", 409);
      if (atual.status !== status) {
        if (atual.status !== statusAnterior) throw erro("O status mudou. Atualize a lista antes de continuar.", 409);
        const [resultado] = await c.query(`UPDATE usuarios SET status = ? WHERE id = ? AND status = ? AND deleted_at IS NULL`,
          [status, atual.id, statusAnterior]);
        if (resultado.affectedRows !== 1) throw erro("O status mudou. Atualize a lista.", 409);
        await c.query(`INSERT INTO logs_auditoria
          (usuario_id, acao, entidade, entidade_id, antes_json, depois_json) VALUES (?, 'alterar_status', 'usuarios', ?, ?, ?)`,
          [administradorId, atual.id, JSON.stringify({ status: atual.status }), JSON.stringify({ status })]);
      }
      await c.commit();
      return { ok: true, publicId, status, emailVerificado: Boolean(atual.email_verificado_em),
        mensagem: status === "bloqueado" ? "Usuário bloqueado." : "Usuário desbloqueado. A verificação de e-mail continua obrigatória." };
    } catch (falha) { await c.rollback(); throw falha; }
    finally { c.release(); }
  }

  async function dashboard() {
    const periodo = periodosAdmin(relogio());
    return consultar(async c => {
      const [[resumo]] = await c.query(`SELECT
        COALESCE(SUM(r.status IN ('aberto','em_andamento')), 0) AS relatosAtivos,
        COALESCE(SUM(m.id IS NULL), 0) AS pendentes,
        COALESCE(SUM(m.decisao = 'aprovado' AND m.created_at >= ? AND m.created_at <= ?), 0) AS aprovadosMes,
        COALESCE(SUM(m.decisao = 'rejeitado' AND m.created_at >= ? AND m.created_at <= ?), 0) AS rejeitadosMes,
        COUNT(DISTINCT r.cidade_id) AS cidadesComRelatos
        FROM relatos r ${ultimaModeracao} WHERE r.deleted_at IS NULL`,
        [periodo.inicioMes, periodo.agora, periodo.inicioMes, periodo.agora]);
      const [fila] = await c.query(`SELECT r.public_id, r.titulo, r.created_at, cat.nome AS categoria,
        cat.slug AS categoria_slug, b.nome AS bairro FROM relatos r
        JOIN categorias_ocorrencia cat ON cat.id = r.categoria_id JOIN bairros b ON b.id = r.bairro_id
        ${ultimaModeracao} WHERE r.deleted_at IS NULL AND m.id IS NULL ORDER BY r.created_at, r.id LIMIT 5`);
      const camposDias = periodo.dias.map((_, indice) =>
        `COALESCE(SUM(created_at >= ? AND created_at < ?), 0) AS d${indice}`).join(", ");
      const [[diarios]] = await c.query(`SELECT ${camposDias} FROM relatos WHERE deleted_at IS NULL
        AND created_at >= ? AND created_at < ?`, [...periodo.dias.flatMap(d => [d.inicio, d.fim]), periodo.dias[0].inicio, periodo.agora]);
      const [categorias] = await c.query(`SELECT cat.slug, cat.nome, COUNT(*) AS total
        FROM relatos r JOIN categorias_ocorrencia cat ON cat.id = r.categoria_id
        WHERE r.deleted_at IS NULL GROUP BY cat.id, cat.slug, cat.nome ORDER BY total DESC, cat.nome`);
      const [atividade] = await c.query(`SELECT tipo, public_id, titulo, ocorrido_em FROM (
        SELECT 'criacao' AS tipo, r.public_id, r.titulo, r.created_at AS ocorrido_em FROM relatos r WHERE r.deleted_at IS NULL
        UNION ALL
        SELECT m.decisao AS tipo, r.public_id, r.titulo, m.created_at AS ocorrido_em FROM moderacoes_relato m
          JOIN relatos r ON r.id = m.relato_id AND r.versao_conteudo = m.versao_conteudo WHERE r.deleted_at IS NULL
        UNION ALL
        SELECT 'cadastro' AS tipo, NULL AS public_id, NULL AS titulo, u.created_at AS ocorrido_em
          FROM usuarios u WHERE u.deleted_at IS NULL
        ) eventos ORDER BY ocorrido_em DESC, tipo, public_id LIMIT 6`);
      const dias = periodo.dias.map((d, indice) => ({ data: d.data, total: Number(diarios["d" + indice]) }));
      return { resumo: numeros(resumo), fila: fila.map(r => ({ publicId: r.public_id, titulo: r.titulo,
        categoria: r.categoria, categoriaSlug: r.categoria_slug, bairro: r.bairro, criadoEm: r.created_at })),
        dias, totalPeriodo: dias.reduce((soma, d) => soma + d.total, 0),
        categorias: categorias.map(cat => ({ slug: cat.slug, nome: cat.nome, total: Number(cat.total) })),
        atividades: atividade.map(a => ({ tipo: a.tipo, publicId: a.public_id, titulo: a.titulo, ocorridoEm: a.ocorrido_em })),
        atualizadoEm: periodo.agora.toISOString(), fuso: periodo.fuso };
    });
  }
  return { listarUsuarios, alterarStatus, dashboard };
}
module.exports = { ...criarAdminModel(), criarAdminModel };
