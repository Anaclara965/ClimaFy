// Carrega database/distritos_sp.csv e database/bairros_sp.csv no banco.
// Idempotente: usa INSERT ... ON DUPLICATE KEY UPDATE, pode rodar sempre.
// Executado automaticamente por apply-schema.js (npm run db:schema).
// Standalone: node database/carregar-geografia.js
const fs = require("node:fs");
const path = require("node:path");

const aqui = (...partes) => path.join(__dirname, ...partes);

// Mesmas regras de normalizarNome() do front-end (app/public/js/dados-publicos.js)
function normalizar(valor = "") {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

function titulo(valor) {
  return valor
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function criarSlug(valor) {
  return valor.replace(/ /g, "-");
}

// GeoSampa grava nomes de distrito sem acento; aqui esta o nome oficial acentuado
const ACENTOS = {
  "agua rasa": "Água Rasa",
  "se": "Sé",
  "bras": "Brás",
  "butanta": "Butantã",
  "sao mateus": "São Mateus",
  "sao miguel": "São Miguel",
  "jacana": "Jaçanã",
  "vila curuca": "Vila Curuçá",
  "jaguare": "Jaguaré",
  "vila sonia": "Vila Sônia",
  "capao redondo": "Capão Redondo",
  "grajau": "Grajaú",
  "jardim sao luis": "Jardim São Luís",
  "vila jacui": "Vila Jacuí",
  "jardim angela": "Jardim Ângela",
  "limao": "Limão",
  "sao domingos": "São Domingos",
  "jaragua": "Jaraguá",
  "sao rafael": "São Rafael",
  "sao lucas": "São Lucas",
  "belem": "Belém",
  "agua branca": "Água Branca",
  "consolacao": "Consolação",
  "sacoma": "Sacomã",
  "saude": "Saúde",
  "tatuape": "Tatuapé",
  "republica": "República",
  "santa cecilia": "Santa Cecília",
  "cidade moncoes": "Cidade Monções",
  "vila olimpia": "Vila Olímpia",
  "carrao": "Carrão",
  "brasilandia": "Brasilândia",
  "cangaiba": "Cangaíba",
  "cidade lider": "Cidade Líder",
  "freguesia do o": "Freguesia do Ó",
  "jose bonifacio": "José Bonifácio",
  "tremembe": "Tremembé",
};

// Nomes GeoSampa (normalizados) que diferem do seed do schema.sql
const ALIASES_SUBPREF = new Map([
  ["casa verde limao cachoeirinha", "casa verde"],
  ["perus anhanguera", "perus"],
  ["freguesia brasilandia", "freguesia do o brasilandia"],
  ["aricanduva formosa carrao", "aricanduva vila formosa"],
]);

// Mini parser de CSV (aspas, virgula e quebra de linha)
function lerCsv(texto) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let entreAspas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === '"') {
      if (entreAspas && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else entreAspas = !entreAspas;
    } else if (c === "," && !entreAspas) {
      linha.push(campo); campo = "";
    } else if ((c === "\n" || c === "\r") && !entreAspas) {
      if (c === "\r" && texto[i + 1] === "\n") i += 1;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((v) => v !== ""));
}

async function carregarGeografia(conexao) {
  const [[cidade]] = await conexao.query(
    "SELECT id FROM cidades WHERE codigo_ibge = '3550308' LIMIT 1"
  );
  if (!cidade) {
    throw new Error("Cidade São Paulo (IBGE 3550308) não encontrada — rode o schema primeiro.");
  }
  const cidadeId = cidade.id;

  const [subprefs] = await conexao.query(
    "SELECT id, nome_normalizado FROM subprefeituras WHERE cidade_id = ?",
    [cidadeId]
  );
  const subprefPorChave = new Map(subprefs.map((s) => [s.nome_normalizado, s.id]));

  // ---- 1. Distritos oficiais (GeoSampa) ----
  const linhas = lerCsv(fs.readFileSync(aqui("distritos_sp.csv"), "utf8"));
  let distritosProcessados = 0;

  for (const [cd, nomeBruto, subprefBruta] of linhas.slice(1)) {
    const chaveDistrito = normalizar(nomeBruto);
    const nomeDistrito = ACENTOS[chaveDistrito] || titulo(chaveDistrito);

    const chaveBruta = normalizar(subprefBruta);
    const chaveSubpref = ALIASES_SUBPREF.get(chaveBruta) || chaveBruta;
    const subprefId = subprefPorChave.get(chaveSubpref);
    if (!subprefId) {
      throw new Error(
        `Subprefeitura não encontrada: "${subprefBruta}" (chave "${chaveSubpref}"). ` +
        "Ajuste o seed do schema.sql ou ALIASES_SUBPREF."
      );
    }

    await conexao.query(
      `INSERT INTO distritos
         (subprefeitura_id, nome, nome_normalizado, codigo_oficial, ativo)
       VALUES (?, ?, ?, ?, 1) AS novo
       ON DUPLICATE KEY UPDATE
         nome = novo.nome,
         subprefeitura_id = novo.subprefeitura_id,
         codigo_oficial = novo.codigo_oficial,
         ativo = 1`,
      [subprefId, nomeDistrito, chaveDistrito, Number(cd)]
    );
    distritosProcessados += 1;
  }

  const [distritos] = await conexao.query(
    `SELECT d.id, d.nome, d.nome_normalizado, d.codigo_oficial
       FROM distritos d
       JOIN subprefeituras s ON s.id = d.subprefeitura_id
      WHERE s.cidade_id = ?`,
    [cidadeId]
  );
  const distritoPorCodigo = new Map(
    distritos
      .filter((d) => d.codigo_oficial !== null)
      .map((d) => [Number(d.codigo_oficial), d])
  );

  // ---- 2. Bairros (OpenStreetMap -> distrito oficial) ----
  const linhasBairros = lerCsv(fs.readFileSync(aqui("bairros_sp.csv"), "utf8"));
  let bairrosProcessados = 0;

  for (const [nomeBruto, cdDistrito, , latBruta, lonBruta] of linhasBairros.slice(1)) {
    const distrito = distritoPorCodigo.get(Number(cdDistrito));
    if (!distrito) {
      throw new Error(`Distrito com código ${cdDistrito} não encontrado para o bairro "${nomeBruto}".`);
    }
    const chave = normalizar(nomeBruto);
    const lat = latBruta ? Number(latBruta) : null;
    const lon = lonBruta ? Number(lonBruta) : null;

    await conexao.query(
      `INSERT INTO bairros
         (cidade_id, distrito_id, nome, nome_normalizado, slug, latitude_centro, longitude_centro, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1) AS novo
       ON DUPLICATE KEY UPDATE
         distrito_id = novo.distrito_id,
         nome = novo.nome,
         slug = novo.slug,
         latitude_centro = novo.latitude_centro,
         longitude_centro = novo.longitude_centro,
         ativo = 1`,
      [cidadeId, distrito.id, nomeBruto, chave, criarSlug(chave), lat, lon]
    );
    bairrosProcessados += 1;
  }

  // ---- 3. Garantia: todo distrito tem ao menos o bairro homonimo ----
  const [bairros] = await conexao.query(
    "SELECT nome_normalizado, distrito_id FROM bairros WHERE cidade_id = ?",
    [cidadeId]
  );
  const chavesPorDistrito = new Map();
  for (const b of bairros) {
    const lista = chavesPorDistrito.get(b.distrito_id) || [];
    lista.push(b.nome_normalizado);
    chavesPorDistrito.set(b.distrito_id, lista);
  }

  let bairrosGarantidos = 0;
  for (const d of distritos) {
    const existentes = chavesPorDistrito.get(d.id) || [];
    if (!existentes.includes(d.nome_normalizado)) {
      await conexao.query(
        `INSERT INTO bairros
           (cidade_id, distrito_id, nome, nome_normalizado, slug, ativo)
         VALUES (?, ?, ?, ?, ?, 1) AS novo
         ON DUPLICATE KEY UPDATE ativo = 1`,
        [cidadeId, d.id, d.nome, d.nome_normalizado, criarSlug(d.nome_normalizado)]
      );
      bairrosGarantidos += 1;
    }
  }

  return { distritosProcessados, bairrosProcessados, bairrosGarantidos };
}

module.exports = { carregarGeografia };

if (require.main === module) {
  require("dotenv").config();
  const mysql = require("mysql2/promise");
  (async () => {
    const conexao = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: Number(process.env.DB_PORT) || 3306,
    });
    try {
      const resultado = await carregarGeografia(conexao);
      console.log("Geografia carregada:", resultado);
      process.exit(0);
    } catch (erro) {
      console.error("FALHA ao carregar geografia ->", erro.message);
      process.exit(1);
    } finally {
      await conexao.end();
    }
  })();
}