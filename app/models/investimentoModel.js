const poolPadrao = require('../config/db');
const { ANO, normalizarRegiao } = require('../helpers/ranking');
const { centavos, decimal, CAMPOS_MONETARIOS, resumir } = require('../helpers/orcamento');
function indisponivel(mensagem) { return Object.assign(new Error(mensagem), { previsto: true, status: 503, codigo: 'ORCAMENTO_INDISPONIVEL' }); }
function criarInvestimentoModel(pool = poolPadrao) {
  async function consultar({ ano = ANO, busca = '', subprefeitura, ordem = 'nome', pagina = 1, limite = 20 } = {}) {
    const c = await pool.getConnection();
    try {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'); await c.beginTransaction();
      // Mesmo conjunto publicado do ranking anual; não mistura arquivos orçamentários sobrepostos.
      const [snapshots] = await c.query(`SELECT CAST(id AS CHAR) AS id, finalizado_em FROM snapshots_prioridade
        WHERE periodo_referencia=? AND status='finalizado' ORDER BY finalizado_em DESC,id DESC LIMIT 1`, [`${ano}-ano`]);
      if (!snapshots.length) throw indisponivel('O orçamento ainda não possui um conjunto publicado para este ano.');
      const snapshot = snapshots[0];
      const [lotes] = await c.query(`SELECT CAST(l.id AS CHAR) AS id, l.nome_arquivo, l.hash_arquivo, l.linhas_importadas, f.nome AS fonte
        FROM snapshot_lotes sl JOIN lotes_importacao l ON l.id=sl.lote_importacao_id
        JOIN fontes_dados f ON f.id=l.fonte_id WHERE sl.snapshot_id=? AND l.status='concluido' AND f.tipo_dado='orcamento'
        ORDER BY l.id`, [snapshot.id]);
      if (lotes.length !== 1) throw indisponivel('O conjunto deve conter exatamente um lote de orçamento concluído.');
      const lote = lotes[0];
      const [registros] = await c.query(`SELECT s.slug, s.nome AS subprefeitura, c.nome AS cidade, c.uf, e.orgao, e.ano,
        e.valor_previsto, e.valor_atualizado, e.valor_congelado, e.valor_descongelado, e.valor_realizado, e.percentual_execucao,
        JSON_UNQUOTE(JSON_EXTRACT(e.dados_originais_json, '$."Executado (%)"')) AS execucao_original
        FROM execucoes_orcamentarias e JOIN subprefeituras s ON s.id=e.subprefeitura_id JOIN cidades c ON c.id=s.cidade_id
        WHERE e.lote_id=? AND e.ano=? AND c.codigo_ibge='3550308' ORDER BY e.id`, [lote.id, ano]);
      if (!registros.length || registros.length !== Number(lote.linhas_importadas) || new Set(registros.map(r => r.slug)).size !== registros.length) {
        throw indisponivel('O lote contém regiões ausentes, duplicadas ou quantidade inconsistente de registros.');
      }
      const linhas = registros.map(r => {
        let valores;
        try { valores = Object.fromEntries(CAMPOS_MONETARIOS.map(campo => [campo, centavos(r['valor_' + campo])])); }
        catch { throw indisponivel('Há valores monetários inválidos no lote de orçamento.'); }
        const execucao = Number(String(r.execucao_original ?? r.percentual_execucao).replace(',', '.'));
        if ((r.execucao_original == null && r.percentual_execucao == null) || !Number.isFinite(execucao) || execucao < 0 || execucao > 999.99) throw indisponivel('Há percentuais inválidos no lote de orçamento.');
        return { centavos: valores, dto: { slug: r.slug, subprefeitura: r.subprefeitura, cidade: r.cidade, uf: r.uf, orgao: r.orgao,
          ano: Number(r.ano), ...Object.fromEntries(CAMPOS_MONETARIOS.map(campo => [campo, decimal(valores[campo])])), execucaoInformada: execucao } };
      });
      const resumo = resumir(linhas), termo = normalizarRegiao(busca);
      const filtradas = linhas.filter(l => (!subprefeitura || l.dto.slug === subprefeitura) &&
        (!termo || normalizarRegiao(l.dto.subprefeitura).includes(termo) || normalizarRegiao(l.dto.orgao).includes(termo)));
      const porNome = (a, b) => a.dto.subprefeitura.localeCompare(b.dto.subprefeitura, 'pt-BR') || a.dto.slug.localeCompare(b.dto.slug);
      const compararValor = (a, b) => a < b ? -1 : a > b ? 1 : 0;
      filtradas.sort((a, b) => {
        if (ordem === 'realizado-maior') return compararValor(b.centavos.realizado, a.centavos.realizado) || porNome(a, b);
        if (ordem === 'realizado-menor') return compararValor(a.centavos.realizado, b.centavos.realizado) || porNome(a, b);
        if (ordem === 'execucao-maior') return b.dto.execucaoInformada - a.dto.execucaoInformada || porNome(a, b);
        return porNome(a, b);
      });
      const total = filtradas.length, resumoFiltrado = resumir(filtradas);
      await c.commit();
      return { orcamentos: filtradas.slice((pagina - 1) * limite, pagina * limite).map(l => l.dto), resumo, resumoFiltrado,
        paginacao: { pagina, limite, total, paginas: Math.ceil(total / limite) },
        filtros: { ano, busca, subprefeitura: subprefeitura || null, ordem },
        opcoes: { anos: [ANO], subprefeituras: [...linhas].sort(porNome).map(l => ({ slug: l.dto.slug, nome: l.dto.subprefeitura, cidade: l.dto.cidade, uf: l.dto.uf })) },
        publicadoEm: snapshot.finalizado_em,
        fonte: { nome: lote.fonte, arquivo: lote.nome_arquivo, sha256: lote.hash_arquivo, linhas: Number(lote.linhas_importadas), dataAtualizacaoExterna: null },
        metodologia: { moeda: 'BRL', valoresMonetarios: 'Texto decimal em reais, com duas casas; totais calculados em centavos.',
          execucaoInformada: 'Percentual do arquivo original, sem tratar como progresso físico de obras.',
          execucaoSobrePrevisto: 'Soma realizada dividida pela soma prevista, em porcentagem com duas casas; nulo se previsto zero. Não é média simples dos percentuais.',
          escopo: 'Orçamento anual por subprefeitura de São Paulo. Não identifica projetos, obras, contratos ou status de execução física.',
          atualidade: 'Publicação no sistema não comprova atualização externa. O arquivo não informa a data de atualização; autenticidade/licença externa não foram certificadas neste bloco.' } };
    } catch (falha) { await c.rollback(); throw falha; }
    finally { c.release(); }
  }
  return { consultar };
}
module.exports = { ...criarInvestimentoModel(), criarInvestimentoModel };
