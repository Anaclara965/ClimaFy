const poolPadrao = require('../config/db');
const { ANO, FORMULA, calcularRanking, inicioPeriodo, normalizarRegiao } = require('../helpers/ranking');
function indisponivel(mensagem = 'O ranking ainda não possui uma importação publicada.') {
  return Object.assign(new Error(mensagem), { previsto: true, status: 503, codigo: 'RANKING_INDISPONIVEL' });
}
function criarRankingModel(pool = poolPadrao) {
  async function consultar({ periodo = 'ano', busca = '', ordem = 'prioridade' } = {}) {
    const c = await pool.getConnection();
    try {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'); await c.beginTransaction();
      const [snapshots] = await c.query(`SELECT CAST(id AS CHAR) AS id, formula_versao, peso_ocorrencias, peso_orcamento, finalizado_em
        FROM snapshots_prioridade WHERE periodo_referencia=? AND status='finalizado'
        ORDER BY finalizado_em DESC,id DESC LIMIT 1`, [`${ANO}-${periodo}`]);
      if (!snapshots.length) throw indisponivel();
      const snapshot = snapshots[0], id = snapshot.id;
      if (snapshot.formula_versao !== FORMULA || Number(snapshot.peso_ocorrencias) !== 0.65 || Number(snapshot.peso_orcamento) !== 0.35) throw indisponivel('A fórmula publicada não corresponde à versão aprovada.');
      const [verbas] = await c.query(`SELECT CAST(e.subprefeitura_id AS CHAR) AS subprefeitura_id, s.slug, e.orgao AS nome,
        e.valor_previsto, e.valor_realizado, e.percentual_execucao,
        JSON_UNQUOTE(JSON_EXTRACT(e.dados_originais_json, '$."Executado (%)"')) AS execucao_original
        FROM execucoes_orcamentarias e JOIN subprefeituras s ON s.id=e.subprefeitura_id
        JOIN lotes_importacao l ON l.id=e.lote_id AND l.status='concluido'
        WHERE e.ano=? AND EXISTS (SELECT 1 FROM snapshot_lotes sl WHERE sl.snapshot_id=? AND sl.lote_importacao_id=e.lote_id)
        ORDER BY e.id`, [ANO, id]);
      const [[base]] = await c.query(`SELECT DATE_FORMAT(MAX(CASE WHEN o.data_ocorrencia >= ? AND o.data_ocorrencia < ? THEN o.data_ocorrencia END),'%Y-%m-%d') AS referencia,
        COUNT(*) AS totalArquivo, COALESCE(SUM(o.data_ocorrencia >= ? AND o.data_ocorrencia < ?),0) AS totalAno
        FROM ocorrencias_oficiais o JOIN lotes_importacao l ON l.id=o.lote_id AND l.status='concluido'
        WHERE EXISTS (SELECT 1 FROM snapshot_lotes sl WHERE sl.snapshot_id=? AND sl.lote_importacao_id=o.lote_id)`,
        [`${ANO}-01-01`, `${ANO + 1}-01-01`, `${ANO}-01-01`, `${ANO + 1}-01-01`, id]);
      if (!base.referencia || !verbas.length) throw indisponivel('Os lotes do ranking estão incompletos.');
      const inicio = inicioPeriodo(base.referencia, periodo);
      const [contagens] = await c.query(`SELECT CAST(o.subprefeitura_id AS CHAR) AS subprefeituraId, COUNT(*) AS total
        FROM ocorrencias_oficiais o JOIN lotes_importacao l ON l.id=o.lote_id AND l.status='concluido'
        WHERE o.data_ocorrencia >= ? AND o.data_ocorrencia <= ?
        AND EXISTS (SELECT 1 FROM snapshot_lotes sl WHERE sl.snapshot_id=? AND sl.lote_importacao_id=o.lote_id)
        GROUP BY o.subprefeitura_id`, [inicio, base.referencia, id]);
      const [resultados] = await c.query(`SELECT CAST(subprefeitura_id AS CHAR) AS subprefeitura_id,
        ocorrencias_normalizadas, deficit_orcamentario_relativo, pontuacao_final, posicao
        FROM snapshot_resultados WHERE snapshot_id=? ORDER BY posicao`, [id]);
      const [lotes] = await c.query(`SELECT l.nome_arquivo, l.hash_arquivo, l.linhas_importadas FROM snapshot_lotes sl
        JOIN lotes_importacao l ON l.id=sl.lote_importacao_id AND l.status='concluido' WHERE sl.snapshot_id=? ORDER BY l.id`, [id]);
      const orcamentos = verbas.map(v => ({ subprefeituraId: String(v.subprefeitura_id), slug: v.slug, nome: v.nome,
        previsto: Number(v.valor_previsto), realizado: Number(v.valor_realizado), execucao: Number(String(v.execucao_original ?? v.percentual_execucao).replace(',', '.')) }));
      if (verbas.some(v => v.valor_previsto == null || v.valor_realizado == null) ||
        orcamentos.some(o => ![o.previsto, o.realizado, o.execucao].every(n => Number.isFinite(n) && n >= 0)) ||
        contagens.some(v => !Number.isSafeInteger(Number(v.total)) || Number(v.total) < 0)) throw indisponivel('Valores de origem inconsistentes no ranking.');
      const locais = new Set(orcamentos.map(o => o.subprefeituraId));
      if (locais.size !== verbas.length || contagens.some(v => !locais.has(String(v.subprefeituraId))) || lotes.length !== 2) throw indisponivel('A composição dos lotes do ranking mudou e precisa de revisão.');
      const ranking = calcularRanking(orcamentos, contagens.map(v => ({ ...v, total: Number(v.total) })));
      const salvos = new Map(resultados.map(r => [String(r.subprefeitura_id), r]));
      if (resultados.length !== ranking.length || ranking.some(r => {
        const s = salvos.get(r.subprefeituraId);
        return !s || Number(s.pontuacao_final) !== r.indice || Number(s.posicao) !== r.posicao ||
          !Number.isFinite(Number(s.ocorrencias_normalizadas)) || !Number.isFinite(Number(s.deficit_orcamentario_relativo)) ||
          Math.abs(Number(s.ocorrencias_normalizadas) - r.normalizadas) > 0.000051 || Math.abs(Number(s.deficit_orcamentario_relativo) - r.deficit) > 0.000051;
      })) throw indisponivel('Os dados não correspondem ao ranking publicado. Uma nova publicação revisada é necessária.');
      const resumo = { areasMonitoradas: ranking.length, ocorrencias: ranking.reduce((s, r) => s + r.ocorrencias, 0),
        areasComOcorrencias: ranking.filter(r => r.ocorrencias > 0).length, orcamentoRealizado: ranking.reduce((s, r) => s + r.realizado, 0) };
      const termo = normalizarRegiao(busca);
      const visiveis = ranking.filter(r => normalizarRegiao(r.nome).includes(termo));
      if (ordem === 'orcamento') visiveis.sort((a, b) => a.realizado - b.realizado || b.ocorrencias - a.ocorrencias || a.posicao - b.posicao);
      await c.commit();
      return { ranking: visiveis.map(({ subprefeituraId, normalizadas, deficit, ...publico }) => publico), resumo,
        filtros: { periodo, busca, ordem }, atualizadoEm: snapshot.finalizado_em,
        metodologia: { versao: FORMULA, ano: ANO, pesos: { ocorrencias: 0.65, orcamento: 0.35 }, inicio, referencia: base.referencia,
          referenciaDoPeriodo: 'Última data de ocorrência do ano no conjunto importado; não o dia atual.',
          ocorrenciasForaAno: Number(base.totalArquivo) - Number(base.totalAno),
          escopo: 'Alagamentos dos CSVs locais e orçamento anual por subprefeitura; não inclui relatos dos usuários.',
          aviso: 'Índice comparativo do projeto, não alerta oficial de risco nem comprovação de efeito do investimento.' },
        fontes: lotes.map(l => ({ arquivo: l.nome_arquivo, sha256: l.hash_arquivo, linhas: Number(l.linhas_importadas) })) };
    } catch (falha) { await c.rollback(); throw falha; }
    finally { c.release(); }
  }
  return { consultar };
}
module.exports = { ...criarRankingModel(), criarRankingModel };
