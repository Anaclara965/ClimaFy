const { normalizar } = require("../helpers/normalizar");

const ESTADOS = "AC:Acre|AL:Alagoas|AP:Amapá|AM:Amazonas|BA:Bahia|CE:Ceará|DF:Distrito Federal|ES:Espírito Santo|GO:Goiás|MA:Maranhão|MT:Mato Grosso|MS:Mato Grosso do Sul|MG:Minas Gerais|PA:Pará|PB:Paraíba|PR:Paraná|PE:Pernambuco|PI:Piauí|RJ:Rio de Janeiro|RN:Rio Grande do Norte|RS:Rio Grande do Sul|RO:Rondônia|RR:Roraima|SC:Santa Catarina|SP:São Paulo|SE:Sergipe|TO:Tocantins";
const ufs = new Map(ESTADOS.split("|").flatMap((item) => {
  const [uf, nome] = item.split(":");
  return [[normalizar(nome), uf], [normalizar(uf), uf]];
}));

function resumirLocal(feature) {
  const p = feature?.properties;
  const coordenadas = feature?.geometry?.coordinates;
  if (!p || feature?.geometry?.type !== "Point" || !Array.isArray(coordenadas)) return null;
  const [longitude, latitude] = coordenadas;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const texto = (valor) => typeof valor === "string" ? valor.slice(0, 200) : "";
  const bairros = [...new Set([p.neighbourhood, p.suburb, p.locality, p.district]
    .map(texto).filter(Boolean))];
  const partes = [p.name, [p.street, p.housenumber].filter(Boolean).join(" "),
    bairros[0], p.city, p.state].map(texto).filter(Boolean);
  return {
    latitude, longitude, endereco: [...new Set(partes)].join(" — "),
    cidade: texto(p.city), uf: ufs.get(normalizar(texto(p.state))) ?? "",
    pais: texto(p.countrycode).toUpperCase(), bairros,
  };
}

function criarGeocodificacaoService({
  requisitar = fetch, baseUrl = process.env.PHOTON_URL || "https://photon.komoot.io",
  intervaloMs = 1000, agora = Date.now,
} = {}) {
  const cache = new Map();
  const emCurso = new Map();
  let fila = Promise.resolve();
  let pendentes = 0;
  let ultimoInicio = 0;

  async function consultar(caminho, parametros) {
    const url = new URL(caminho, baseUrl);
    for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor);
    const chave = url.href;
    const salvo = cache.get(chave);
    if (salvo && salvo.expira > agora()) return salvo.dados;
    if (emCurso.has(chave)) return emCurso.get(chave);
    if (pendentes >= 4) {
      throw Object.assign(new Error("Muitas buscas em andamento. Aguarde e tente novamente."), { status: 429 });
    }
    pendentes++;
    const trabalho = fila.then(async () => {
      const espera = Math.max(0, ultimoInicio + intervaloMs - agora());
      if (espera) await new Promise((resolve) => setTimeout(resolve, espera));
      ultimoInicio = agora();
      const resposta = await requisitar(url, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json", "User-Agent": "ClimaFy-TCC/1.0" },
      });
      if (!resposta.ok) throw new Error("Falha no serviço de endereços");
      const corpo = await resposta.json();
      if (!Array.isArray(corpo.features)) throw new Error("Resposta inválida do serviço de endereços");
      const dados = corpo.features.map(resumirLocal).filter(Boolean);
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(chave, { dados, expira: agora() + 120000 });
      return dados;
    }).catch(() => {
      throw Object.assign(new Error("A busca de endereço está indisponível. Tente novamente ou use o mapa."), { status: 503 });
    });
    fila = trabalho.catch(() => {});
    emCurso.set(chave, trabalho);
    try {
      return await trabalho;
    } finally {
      pendentes--;
      emCurso.delete(chave);
    }
  }

  async function buscarEnderecos(termo) {
    const dados = await consultar("/api/", {
      q: termo, limit: 6, countrycode: "BR", lat: -23.5505, lon: -46.6333,
    });
    return dados.filter((item) => item.pais === "BR");
  }
  async function identificarPonto(latitude, longitude) {
    const dados = await consultar("/reverse", { lat: latitude, lon: longitude, limit: 1, radius: 1 });
    return dados[0] ?? null;
  }
  return { buscarEnderecos, identificarPonto };
}

module.exports = { ...criarGeocodificacaoService(), criarGeocodificacaoService, resumirLocal };
