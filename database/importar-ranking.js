// Sem argumento de confirmação: somente prévia. Não executa schema/reset.
const fs = require('node:fs'), path = require('node:path');
function lerArquivos() {
  const ler = nome => {
    const arquivo = fs.readFileSync(path.join(__dirname, '../DADOS', nome));
    if (arquivo.length > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MiB.');
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(arquivo);
  };
  return { ocorrenciasTexto: ler('alagamentos_defesa_civil_sp_2026.csv'), orcamentoTexto: ler('orcamento_subprefeituras_sp_2026.csv') };
}
async function executar(args, model) {
  if (args.some(a => !/^--(?:confirmar=[a-f0-9]{64}|operador=[a-f0-9-]{36})$/.test(a)) || new Set(args.map(a => a.split('=')[0])).size !== args.length) throw new Error('Argumentos inválidos. Use --confirmar=ASSINATURA --operador=UUID ou nenhum argumento para prévia.');
  const textos = lerArquivos();
  if (!args.length) return model.validar(textos);
  const assinatura = args.find(a => a.startsWith('--confirmar='))?.slice(12), operadorPublicId = args.find(a => a.startsWith('--operador='))?.slice(11);
  if (!assinatura || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(operadorPublicId || '')) throw new Error('Confirmação e UUID do operador são obrigatórios.');
  return model.importar({ textos, assinatura, operadorPublicId });
}
if (require.main === module) {
  require('dotenv').config({ quiet: true }); const pool = require('../app/config/db');
  executar(process.argv.slice(2), require('../app/models/importacaoRankingModel')).then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => { console.error('Importação interrompida:', e.code || e.message); process.exitCode = 1; }).finally(() => pool.end());
}
module.exports = { lerArquivos, executar };
