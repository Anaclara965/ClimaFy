const { lerArquivos } = require('../../database/importar-ranking');
const { prepararDados } = require('../../app/helpers/prepararDadosRanking');
const { normalizarRegiao } = require('../../app/helpers/ranking');
const textos = lerArquivos();
const geografia = textos.orcamentoTexto.trim().split(/\r?\n/).slice(1).map((l, i) => {
  const nome = l.split(';')[0].replace(/^"|"$/g, ''), chave = normalizarRegiao(nome);
  return { id: String(i + 1), nome_normalizado: chave, slug: chave.replaceAll(' ', '-') };
});
function plano() { return prepararDados({ ...textos, geografia }); }
function poolImportacao({ existentes = false, outroHash = false, falharAudit = false, ator = true, lock = true } = {}) {
  const chamadas = [], fontes = new Map(); let proximo = 1;
  const dados = plano();
  const c = { beginTransaction: async () => chamadas.push({ sql: 'BEGIN' }), commit: async () => chamadas.push({ sql: 'COMMIT' }),
    rollback: async () => chamadas.push({ sql: 'ROLLBACK' }), release: () => chamadas.push({ sql: 'RELEASE' }),
    async query(sql, parametros = []) {
      chamadas.push({ sql, parametros }); let linhas = [];
      if (sql.includes('GET_LOCK')) linhas = [{ obtido: lock ? 1 : 0 }];
      else if (sql.includes('JOIN papeis')) linhas = ator ? [{ id: '9' }] : [];
      else if (sql.includes('FROM subprefeituras s')) linhas = geografia;
      else if (sql.startsWith('SELECT id, tipo_dado')) {
        if (existentes) { const id = parametros[0].includes('alagamentos') ? 1 : 2; linhas = [{ id, tipo_dado: id === 1 ? 'ocorrencias' : 'orcamento', ativo: 1 }]; }
      } else if (sql.startsWith('SELECT id, hash_arquivo')) {
        if (existentes) linhas = [{ id: parametros[0] + 10, status: 'concluido', hash_arquivo: outroHash ? 'x' : dados.hashes[parametros[0] === 1 ? 'ocorrencias' : 'orcamento'] }];
      } else if (sql.startsWith('SELECT COUNT(*)')) linhas = [{ total: sql.includes('snapshots_prioridade') ? 4 : 0 }];
      else if (sql.startsWith('INSERT INTO logs_auditoria') && falharAudit) throw new Error('Auditoria indisponível');
      else if (sql.startsWith('INSERT')) linhas = { insertId: proximo++, affectedRows: 1 };
      return [linhas, []];
    } };
  return { chamadas, getConnection: async () => c, query: c.query };
}
module.exports = { textos, geografia, plano, poolImportacao };
