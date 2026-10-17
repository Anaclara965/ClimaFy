// Migração aditiva e retomável. Não executa o reset do schema nem apaga registros.
const fs = require("node:fs");
const path = require("node:path");

function definicoes() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const tabela = schema.match(/CREATE TABLE relato_revisoes \([\s\S]*?;/)?.[0];
  const view = schema.match(/CREATE OR REPLACE VIEW vw_relatos_publicos AS[\s\S]*?;/)?.[0];
  if (!tabela || !view?.includes("decisao_final.versao_conteudo = r.versao_conteudo")) {
    throw new Error("Definições de versionamento não encontradas no schema.");
  }
  return { tabela: tabela.replace("CREATE TABLE relato_revisoes", "CREATE TABLE IF NOT EXISTS relato_revisoes"), view };
}

async function migrarEdicao(pool) {
  const sql = definicoes();
  const conexao = await pool.getConnection();
  let bloqueada = false;
  try {
    const [[lock]] = await conexao.query("SELECT GET_LOCK('climafy_migracao_relato', 10) AS obtido");
    if (Number(lock.obtido) !== 1) throw new Error("Outra migração está em andamento.");
    bloqueada = true;
    const pendentes = [];
    // Verifica ambos os campos antes de executar DDL (que faz commit implícito).
    for (const tabela of ["relatos", "moderacoes_relato"]) {
      const [colunas] = await conexao.query(`SHOW COLUMNS FROM ${tabela}`);
      const versao = colunas.find(c => c.Field === "versao_conteudo");
      if (!versao) pendentes.push(`ALTER TABLE ${tabela} ADD COLUMN versao_conteudo INT UNSIGNED NOT NULL DEFAULT 1`);
      else if (!/^int(?:\(\d+\))? unsigned$/i.test(versao.Type) || versao.Null !== "NO" || String(versao.Default) !== "1") {
        throw new Error(`Coluna de versão incompatível em ${tabela}. Migração interrompida.`);
      }
    }
    const [historico] = await conexao.query(`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'relato_revisoes'`);
    if (historico.length) {
      for (const [nome, tipo] of [["relato_id", "bigint"], ["versao_conteudo", "int"], ["conteudo", "json"],
        ["editado_por_usuario_id", "bigint"], ["created_at", "datetime"]]) {
        if (!historico.some(c => c.COLUMN_NAME === nome && c.DATA_TYPE === tipo && c.IS_NULLABLE === "NO")) {
          throw new Error("Tabela de histórico incompatível. Migração interrompida.");
        }
      }
    }
    await conexao.query("SET SESSION lock_wait_timeout = 15");
    for (const comando of pendentes) await conexao.query(comando);
    await conexao.query(sql.tabela);
    await conexao.query(sql.view);
    return { ok: true, colunasAdicionadas: pendentes.length };
  } finally {
    try {
      if (bloqueada) await conexao.query("SELECT RELEASE_LOCK('climafy_migracao_relato')");
    } finally { conexao.release(); }
  }
}

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  const pool = require("../app/config/db");
  migrarEdicao(pool).then(resultado => console.log("Migração de edição concluída, preservando registros:", resultado))
    .catch(erro => { console.error("Falha na migração de edição:", erro.code || erro.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
module.exports = { migrarEdicao, definicoes };
