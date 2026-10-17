// Consulta REAL de bairros (substitui o mock com 3 bairros).
// Fonte unica de verdade das telas: /api/bairros, cadastro e preferencias.
const poolPadrao = require("../config/db");
const { normalizar } = require("../helpers/normalizar");

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 50;

// %, _ e \ tem significado dentro do LIKE; sem escapar, "%%" listaria tudo.
function escaparCuringa(texto) {
  return texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

function criarBairroModel(pool = poolPadrao) {
  // O termo entra normalizado (sem acento, minusculo) porque bairros.nome_normalizado
  // ja foi gravado assim por database/carregar-geografia.js.
  async function buscarBairros(termo = "", limite = LIMITE_PADRAO) {
    const termoNormalizado = escaparCuringa(normalizar(termo));
    const limiteSeguro = Math.min(
      Math.max(Number(limite) || LIMITE_PADRAO, 1),
      LIMITE_MAXIMO
    );

    const [linhas] = await pool.query(
      `SELECT b.id, b.nome, c.nome AS cidade
         FROM bairros b
         JOIN cidades c ON c.id = b.cidade_id
        WHERE b.ativo = 1
          AND b.nome_normalizado LIKE ?
        ORDER BY b.nome
        LIMIT ?`,
      [`%${termoNormalizado}%`, limiteSeguro]
    );

    return linhas;
  }

  async function buscarPorId(id) {
    const [linhas] = await pool.query(
      `SELECT b.id, b.nome, b.distrito_id, c.nome AS cidade
         FROM bairros b
         JOIN cidades c ON c.id = b.cidade_id
        WHERE b.id = ? AND b.ativo = 1
        LIMIT 1`,
      [id]
    );
    return linhas[0] ?? null;
  }

  async function listarCidades() {
    const [linhas] = await pool.query(
      "SELECT id, nome, uf FROM cidades WHERE ativo = 1 ORDER BY nome"
    );
    return linhas;
  }

  async function buscarPorLocalizacao({ cidade, uf, bairros }) {
    if (!cidade || !uf || !bairros.length) return null;
    const nomes = [...new Set(bairros.map(normalizar))];
    const [linhas] = await pool.query(
      `SELECT b.id, b.nome, b.nome_normalizado, c.nome AS cidade
         FROM bairros b JOIN cidades c ON c.id = b.cidade_id
        WHERE b.ativo = 1 AND c.ativo = 1 AND c.nome = ? AND c.uf = ?
          AND b.nome_normalizado IN (${nomes.map(() => "?").join(", ")})`,
      [cidade, uf, ...nomes]
    );
    // Prioriza bairro/localidade antes de distrito. Nunca escolhe nome parcial.
    for (const nome of nomes) {
      const exatos = linhas.filter((item) => item.nome_normalizado === nome);
      if (exatos.length > 1) return null;
      if (exatos.length === 1) {
        const { id, nome: nomeBairro, cidade: nomeCidade } = exatos[0];
        return { id, nome: nomeBairro, cidade: nomeCidade };
      }
    }
    return null;
  }

  return { buscarBairros, buscarPorId, listarCidades, buscarPorLocalizacao };
}

module.exports = { ...criarBairroModel(), criarBairroModel, escaparCuringa };
