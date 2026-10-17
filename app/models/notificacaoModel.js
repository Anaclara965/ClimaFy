const poolPadrao = require('../config/db');
const TIPOS_RELATO = ['relato_aprovado', 'relato_rejeitado', 'relato_ajuste', 'relato_situacao'];
const SITUACOES = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };
function erro(mensagem, status) { return Object.assign(new Error(mensagem), { previsto: true, status }); }

// Usa a conexão/transação da moderação; não abre outra nem confirma isoladamente.
async function registrarAtualizacao(conexao, { usuarioId, tituloRelato, versao, decisao, situacao, statusAnterior }) {
  const decisoes = {
    aprovado: ['relato_aprovado', 'Relato aprovado', 'foi aprovada'],
    rejeitado: ['relato_rejeitado', 'Relato rejeitado', 'foi rejeitada'],
    solicitado_ajuste: ['relato_ajuste', 'Seu relato precisa de ajustes', 'recebeu uma solicitação de ajustes'],
  };
  let tipo, titulo, mensagem;
  if (situacao !== undefined) {
    if (!SITUACOES[situacao] || !SITUACOES[statusAnterior]) throw new Error('Situação inválida ao registrar notificação.');
    tipo = 'relato_situacao'; titulo = 'Situação do relato atualizada';
    mensagem = `A situação do relato "${tituloRelato}", versão ${versao}, mudou de "${SITUACOES[statusAnterior]}" para "${SITUACOES[situacao]}". Consulte Meus relatos para ver os detalhes.`;
  } else {
    if (!decisoes[decisao]) throw new Error('Decisão inválida ao registrar notificação.');
    let acao; [tipo, titulo, acao] = decisoes[decisao];
    mensagem = `A versão ${versao} do relato "${tituloRelato}" ${acao}. Consulte Meus relatos para ver os detalhes.`;
  }
  if (usuarioId === undefined || typeof tituloRelato !== 'string') throw new Error('Autor ou título ausente ao registrar notificação.');
  // Avisos do próprio relato são imediatos. Frequência/silencioso ficam para alertas regionais.
  // Preferência ausente mantém o padrão do schema: canal interno habilitado.
  await conexao.query(`INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, enviada_em, created_at)
    SELECT u.id, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP() FROM usuarios u
    LEFT JOIN preferencias_notificacao p ON p.usuario_id = u.id
    WHERE u.id = ? AND u.status = 'ativo' AND u.deleted_at IS NULL AND u.email_verificado_em IS NOT NULL
    AND COALESCE(p.canal_sistema, 1) = 1`, [tipo, titulo, mensagem, usuarioId]);
}
function apresentar(n) {
  return { id: String(n.id), tipo: n.tipo, titulo: n.titulo, mensagem: n.mensagem,
    criadaEm: n.created_at, enviadaEm: n.enviada_em, lidaEm: n.lida_em,
    destino: TIPOS_RELATO.includes(n.tipo) ? '/meus-relatos' : null };
}
function criarNotificacaoModel(pool = poolPadrao) {
  async function listar({ usuarioId, pagina = 1, limite = 10, somenteNaoLidas = false }) {
    const c = await pool.getConnection();
    try {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'); await c.beginTransaction();
      const [[{ agora }]] = await c.query('SELECT UTC_TIMESTAMP() AS agora');
      const base = 'FROM notificacoes n WHERE n.usuario_id = ? AND n.enviada_em IS NOT NULL AND n.enviada_em <= ?';
      const [linhas] = await c.query(`SELECT CAST(n.id AS CHAR) AS id, n.tipo, n.titulo, n.mensagem, n.created_at,
        n.enviada_em, n.lida_em ${base} ${somenteNaoLidas ? 'AND n.lida_em IS NULL' : ''}
        ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`, [usuarioId, agora, limite, (pagina - 1) * limite]);
      const [[contagem]] = await c.query(`SELECT COUNT(*) AS total, COALESCE(SUM(n.lida_em IS NULL), 0) AS naoLidas ${base}`, [usuarioId, agora]);
      const total = Number(contagem.total), naoLidas = Number(contagem.naoLidas), filtradas = somenteNaoLidas ? naoLidas : total;
      await c.commit();
      return { notificacoes: linhas.map(apresentar), resumo: { total, naoLidas },
        paginacao: { pagina, limite, total: filtradas, paginas: Math.ceil(filtradas / limite) } };
    } catch (falha) { await c.rollback(); throw falha; }
    finally { c.release(); }
  }
  async function marcarLida({ usuarioId, id }) {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      const [linhas] = await c.query(`SELECT lida_em FROM notificacoes WHERE id = ? AND usuario_id = ?
        AND enviada_em IS NOT NULL AND enviada_em <= UTC_TIMESTAMP() FOR UPDATE`, [id, usuarioId]);
      if (!linhas.length) throw erro('Notificação não encontrada.', 404);
      let lidaEm = linhas[0].lida_em;
      if (!lidaEm) {
        await c.query(`UPDATE notificacoes SET lida_em = UTC_TIMESTAMP() WHERE id = ? AND usuario_id = ? AND lida_em IS NULL`, [id, usuarioId]);
        const [[atual]] = await c.query('SELECT lida_em FROM notificacoes WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
        if (!atual?.lida_em) throw new Error('Leitura da notificação não confirmada.');
        lidaEm = atual.lida_em;
      }
      await c.commit(); return { ok: true, id, lidaEm };
    } catch (falha) { await c.rollback(); throw falha; }
    finally { c.release(); }
  }
  return { listar, marcarLida };
}
module.exports = { ...criarNotificacaoModel(), criarNotificacaoModel, registrarAtualizacao };
