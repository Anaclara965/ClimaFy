// Aplica o database/schema.sql no banco configurado no .env
// Uso: npm run db:schema
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

(async () => {
  const caminhoSchema = path.join(__dirname, "schema.sql");
  // le em UTF-8 e remove BOM, se existir
  const sql = fs.readFileSync(caminhoSchema, "utf8").replace(/^\uFEFF/, "");

  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
    multipleStatements: true, // permite executar o arquivo inteiro de uma vez
  });

  try {
    console.log(
      `Aplicando schema em "${process.env.DB_DATABASE}" (${process.env.DB_HOST})...`
    );
    await conexao.query(sql);

    // Carrega os 96 distritos oficiais (GeoSampa) + bairros (OpenStreetMap)
    const { carregarGeografia } = require("./carregar-geografia");
    const geografia = await carregarGeografia(conexao);
    console.log("\nGeografia carregada:", geografia);

    const [tabelas] = await conexao.query("SHOW TABLES");
    console.log(`\nOK! ${tabelas.length} tabelas criadas:`);
    for (const t of tabelas) console.log("  -", Object.values(t)[0]);

    // conferencia dos dados iniciais (seeds)
    const seeds = [
      ["papeis", 3],
      ["documentos_legais", 2],
      ["categorias_ocorrencia", 14],
      ["motivos_moderacao", 6],
      ["cidades", 1],
      ["subprefeituras", 32],
      ["distritos", 96],
    ];
        console.log("\nConferencia dos dados iniciais (seeds):");
    const tabelasPermitidas = new Set([
      "papeis",
      "documentos_legais",
      "categorias_ocorrencia",
      "motivos_moderacao",
      "cidades",
      "subprefeituras",
      "distritos",
      "bairros",
    ]);
    for (const [tabela, esperado] of seeds) {
      if (!tabelasPermitidas.has(tabela)) {
        throw new Error(`Tabela desconhecida na conferencia de seeds: ${tabela}`);
      }
      const [[{ n }]] = await conexao.query(
        `SELECT COUNT(*) AS n FROM ${tabela}`
      );
      const situacao = n === esperado ? "OK" : `esperado: ${esperado}`;
      console.log(`  - ${tabela}: ${n} (${situacao})`);
    }

    const [[{ n: totalBairros }]] = await conexao.query(
      "SELECT COUNT(*) AS n FROM bairros"
    );
    console.log(
      `  - bairros: ${totalBairros} (OpenStreetMap + GeoSampa, com garantia de bairro homonimo)`
    );

    process.exit(0);
  } catch (err) {
    console.error("\nFALHA ao aplicar schema ->", err.message);
    process.exit(1);
  } finally {
    await conexao.end();
  }
})();
