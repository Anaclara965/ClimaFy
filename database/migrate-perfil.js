// Adiciona campos opcionais de perfil sem recriar tabelas nem alterar registros.
// Uso: npm run db:migrate:perfil
require("dotenv").config();
const mysql = require("mysql2/promise");

const COLUNAS = [
  ["email_pendente", "VARCHAR(190)"],
  ["telefone", "VARCHAR(25)"],
  ["foto_perfil_chave", "VARCHAR(80)"],
  ["foto_perfil_mime_type", "VARCHAR(30)"],
  ["foto_perfil_tamanho_bytes", "INT UNSIGNED"],
];

async function migrar() {
  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 3306,
  });
  try {
    const [existentes] = await conexao.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'`
    );
    const presentes = new Set(existentes.map(coluna => coluna.COLUMN_NAME));
    for (const [nome, definicao] of COLUNAS) {
      if (presentes.has(nome)) continue;
      await conexao.query(`ALTER TABLE usuarios ADD COLUMN \`${nome}\` ${definicao} NULL`);
      console.log(`Adicionada usuarios.${nome}`);
    }
    console.log("Migração de perfil concluída.");
  } finally {
    await conexao.end();
  }
}

migrar().catch(erro => {
  console.error("Falha na migração de perfil:", erro.message);
  process.exitCode = 1;
});
