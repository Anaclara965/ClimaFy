// Atualizacao pontual. NUNCA usa DROP nem executa apply-schema.js.
require("dotenv").config({ quiet: true });
const pool = require("../app/config/db");
const fs = require("node:fs");
const path = require("node:path");

async function migrar() {
  const conexao = await pool.getConnection();
  let bloqueada = false;
  try {
    const [[lock]] = await conexao.query("SELECT GET_LOCK('climafy_migracao_relato', 10) AS obtido");
    if (Number(lock.obtido) !== 1) throw new Error("Outra migração está em andamento.");
    bloqueada = true;
    const ajustes = [];
    for (const [tabela, campos] of [["relatos", ["status"]], ["historico_status_relato", ["status_anterior", "status_novo"]]]) {
      const [colunas] = await conexao.query(`SHOW COLUMNS FROM ${tabela}`);
      const antigos = colunas.filter(c => campos.includes(c.Field) && !c.Type.includes("'aberto'"));
      if (antigos.length) {
        const [[contagem]] = await conexao.query(`SELECT COUNT(*) AS total FROM ${tabela}`);
        // Nao adivinha o significado dos estados legados nem reescreve historicos.
        if (Number(contagem.total) !== 0) throw new Error(`Migração interrompida: ${tabela} possui dados legados. Planeje a conversão com o grupo; nada foi alterado.`);
        for (const c of antigos) ajustes.push(`ALTER TABLE ${tabela} MODIFY ${c.Field}
          ENUM('aberto','em_andamento','resolvido') ${c.Null === "YES" ? "NULL" : "NOT NULL"}
          ${tabela === "relatos" ? "DEFAULT 'aberto'" : ""}`);
      }
    }
    // MySQL DDL faz commit implicito. Operacoes sao retomaveis, nao um reset.
    for (const sql of ajustes) await conexao.query(sql);
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    const view = schema.match(/CREATE OR REPLACE VIEW vw_relatos_publicos AS[\s\S]*?;/)?.[0];
    if (!view || !view.includes("r.gravidade")) throw new Error("Definição da view não encontrada.");
    await conexao.query(view);
    console.log("Status alinhados e view pública atualizada. Nenhum registro foi apagado.");
  } finally {
    if (bloqueada) await conexao.query("SELECT RELEASE_LOCK('climafy_migracao_relato')");
    conexao.release();
  }
}
if (require.main === module) migrar().catch(e => {
  console.error("Falha na migração:", e.code || e.message); process.exitCode = 1;
}).finally(() => pool.end());
module.exports = { migrar };
