// Regra UNICA de normalizacao de nomes (bairros, distritos, subprefeituras).
// Usada pelo carregamento da geografia (database/) e pelos modelos (app/models/).
// Mantem o mesmo comportamento do normalizarNome() do front-end
// (app/public/js/dados-publicos.js), que roda no navegador e por isso nao pode
// importar este modulo.
function normalizar(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

// "freguesia do o" -> "Freguesia do O" (mantem particulas em minusculas)
function titulo(valor = "") {
  return String(valor)
    .split(" ")
    .map((palavra, indice) =>
      indice > 0 && PARTICULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toUpperCase() + palavra.slice(1)
    )
    .join(" ");
}

function criarSlug(valor = "") {
  return normalizar(valor).replace(/ /g, "-");
}

module.exports = { normalizar, titulo, criarSlug, PARTICULAS };
