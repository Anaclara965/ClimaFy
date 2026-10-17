const poolPadrao = require('../config/db');
const { prepararDados } = require('../helpers/prepararDadosRanking');
const { ANO, FORMULA, PERIODOS } = require('../helpers/ranking');
const FONTES = [
  { chave: 'ocorrencias', nome: 'ClimaFy CSV local - alagamentos 2026', tipo: 'ocorrencias', arquivo: 'alagamentos_defesa_civil_sp_2026.csv', tabela: 'ocorrencias_oficiais' },
  { chave: 'orcamento', nome: 'ClimaFy CSV local - orcamento subprefeituras 2026', tipo: 'orcamento', arquivo: 'orcamento_subprefeituras_sp_2026.csv', tabela: 'execucoes_orcamentarias' },
];
async function planoNaConexao(c, textos, travar = false) {
  const [geo] = await c.query(`SELECT CAST(s.id AS CHAR) AS id, s.nome_normalizado, s.slug FROM subprefeituras s
    JOIN cidades c ON c.id = s.cidade_id WHERE c.codigo_ibge = '3550308' ORDER BY s.id ${travar ? 'FOR SHARE' : ''}`);
  return prepararDados({ ...textos, geografia: geo });
}
async function inserirLoteDeLinhas(c, prefixo, linhas) {
  for (let i = 0; i < linhas.length; i += 100) {
    const parte = linhas.slice(i, i + 100);
    await c.query(prefixo + ' VALUES ' + parte.map(l => '(' + l.map(() => '?').join(',') + ')').join(','), parte.flat());
  }
}
function criarImportacaoRankingModel(pool = poolPadrao) {
  async function validar(textos) { return (await planoNaConexao(pool, textos)).previa; }
  async function importar({ textos, assinatura, operadorPublicId }) {
    const c = await pool.getConnection(); let lock = false, transacao = false;
    try {
      const [[trava]] = await c.query("SELECT GET_LOCK('climafy_importacao_ranking_v1', 10) AS obtido");
      if (Number(trava.obtido) !== 1) throw new Error('Outra importação está em andamento.'); lock = true;
      await c.beginTransaction(); transacao = true;
      const [atores] = await c.query(`SELECT CAST(u.id AS CHAR) AS id FROM usuarios u JOIN papeis p ON p.id=u.papel_id
        WHERE u.public_id = ? AND p.codigo IN ('moderador','administrador') AND u.status='ativo'
        AND u.email_verificado_em IS NOT NULL AND u.deleted_at IS NULL FOR UPDATE`, [operadorPublicId]);
      if (atores.length !== 1) throw new Error('Operador inexistente ou sem permissão para importar.');
      const plano = await planoNaConexao(c, textos, true);
      if (assinatura !== plano.assinatura) throw new Error('Prévia desatualizada. Valide novamente e confirme a assinatura atual.');
      const lotes = [];
      for (const f of FONTES) {
        const [existentes] = await c.query('SELECT id, tipo_dado, ativo FROM fontes_dados WHERE nome = ? FOR UPDATE', [f.nome]);
        let fonteId;
        if (existentes.length) {
          if (existentes[0].tipo_dado !== f.tipo || Number(existentes[0].ativo) !== 1) throw new Error('Fonte existente incompatível ou inativa.');
          fonteId = existentes[0].id;
        } else {
          const [nova] = await c.query('INSERT INTO fontes_dados (nome, tipo_dado) VALUES (?, ?)', [f.nome, f.tipo]); fonteId = nova.insertId;
        }
        const [anteriores] = await c.query('SELECT id, hash_arquivo, status FROM lotes_importacao WHERE fonte_id = ? FOR UPDATE', [fonteId]);
        if (anteriores.length) {
          if (anteriores.length !== 1 || anteriores[0].status !== 'concluido' || anteriores[0].hash_arquivo !== plano.hashes[f.chave]) {
            throw new Error('A fonte já tem outro lote. Este importador inicial não sobrescreve ou substitui dados existentes.');
          }
          lotes.push({ ...f, fonteId, loteId: anteriores[0].id, existente: true });
        } else {
          const [[contagem]] = await c.query(`SELECT COUNT(*) AS total FROM ${f.tabela} WHERE fonte_id = ?`, [fonteId]);
          if (Number(contagem.total)) throw new Error('Há dados sem lote compatível. Importação interrompida para preservá-los.');
          lotes.push({ ...f, fonteId, existente: false });
        }
      }
      if (lotes.every(l => l.existente)) {
        const [[n]] = await c.query(`SELECT COUNT(*) AS total FROM snapshots_prioridade s
          WHERE s.formula_versao = ? AND s.status='finalizado' AND s.periodo_referencia IN (?,?,?,?)
          AND (SELECT COUNT(*) FROM snapshot_lotes sl WHERE sl.snapshot_id=s.id AND sl.lote_importacao_id IN (?,?))=2`,
          [FORMULA, ...PERIODOS.map(p => `${ANO}-${p}`), ...lotes.map(l => l.loteId)]);
        if (Number(n.total) < 4) throw new Error('Lotes existentes sem os quatro rankings completos. Exige revisão manual, sem duplicar dados.');
        await c.commit(); transacao = false; return { ok: true, jaImportado: true, ...plano.previa };
      }
      if (lotes.some(l => l.existente)) throw new Error('Somente parte dos arquivos já foi importada. Revisão necessária, sem sobrepor os dados.');
      for (const l of lotes) {
        const quantidade = l.chave === 'ocorrencias' ? plano.ocorrencias.length : plano.orcamentos.length;
        const [novo] = await c.query(`INSERT INTO lotes_importacao
          (fonte_id,nome_arquivo,hash_arquivo,periodo_referencia,status,linhas_lidas,importado_por_usuario_id)
          VALUES (?,?,?,?,'importando',?,?)`, [l.fonteId, l.arquivo, plano.hashes[l.chave], String(ANO), quantidade, atores[0].id]);
        l.loteId = novo.insertId;
        if (l.chave === 'ocorrencias') await inserirLoteDeLinhas(c, `INSERT INTO ocorrencias_oficiais
          (lote_id,fonte_id,id_externo,data_ocorrencia,tipo,subprefeitura_id,latitude,longitude,dados_originais_json)`,
          plano.ocorrencias.map(o => [l.loteId, l.fonteId, o.idExterno, o.data, o.tipo, o.subprefeituraId, o.latitude, o.longitude, JSON.stringify(o.original)]));
        else await inserirLoteDeLinhas(c, `INSERT INTO execucoes_orcamentarias
          (lote_id,fonte_id,subprefeitura_id,ano,periodo_referencia,orgao,valor_previsto,valor_atualizado,valor_congelado,valor_descongelado,valor_realizado,percentual_execucao,dados_originais_json)`,
          plano.orcamentos.map(o => [l.loteId, l.fonteId, o.subprefeituraId, ANO, String(ANO), o.nome, ...o.valores, JSON.stringify(o.original)]));
        await c.query("UPDATE lotes_importacao SET status='concluido', finalizado_em=UTC_TIMESTAMP(), linhas_importadas=? WHERE id=?", [quantidade, l.loteId]);
      }
      for (const periodo of PERIODOS) {
        const [snapshot] = await c.query(`INSERT INTO snapshots_prioridade
          (periodo_referencia,formula_versao,peso_ocorrencias,peso_orcamento,gerado_por_usuario_id)
          VALUES (?,?,0.650,0.350,?)`, [`${ANO}-${periodo}`, FORMULA, atores[0].id]);
        const snapshotId = snapshot.insertId;
        await inserirLoteDeLinhas(c, 'INSERT INTO snapshot_lotes (snapshot_id,lote_importacao_id)', lotes.map(l => [snapshotId, l.loteId]));
        await inserirLoteDeLinhas(c, `INSERT INTO snapshot_resultados
          (snapshot_id,subprefeitura_id,ocorrencias_normalizadas,deficit_orcamentario_relativo,pontuacao_final,posicao)`,
          plano.rankings[periodo].linhas.map(r => [snapshotId, r.subprefeituraId, r.normalizadas.toFixed(4), r.deficit.toFixed(4), r.indice, r.posicao]));
        await c.query("UPDATE snapshots_prioridade SET status='finalizado', finalizado_em=UTC_TIMESTAMP() WHERE id=?", [snapshotId]);
      }
      await c.query(`INSERT INTO logs_auditoria (usuario_id,acao,entidade,entidade_id,depois_json)
        VALUES (?,'importar_ranking','lotes_importacao',?,?)`, [atores[0].id, lotes[0].loteId, JSON.stringify(plano.previa)]);
      await c.commit(); transacao = false; return { ok: true, jaImportado: false, ...plano.previa };
    } catch (falha) { if (transacao) await c.rollback(); throw falha; }
    finally { try { if (lock) await c.query("SELECT RELEASE_LOCK('climafy_importacao_ranking_v1')"); } finally { c.release(); } }
  }
  return { validar, importar };
}
module.exports = { ...criarImportacaoRankingModel(), criarImportacaoRankingModel };
