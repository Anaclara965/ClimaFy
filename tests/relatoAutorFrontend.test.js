// Testes da integração de JavaScript em DOM simulado; não substituem teste visual.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", csrf = "a".repeat(64);
const inicial = { publicId: id, versao: "2", titulo: 'Título " <img src=x>', descricao: "Descrição anterior",
  categoriaSlug: "alagamento", severidade: "grave", bairroId: 85, bairro: "Consolação", cidade: "São Paulo",
  latitude: -23.55, longitude: -46.63, referencia: "Na esquina", csrfToken: csrf };

class Elemento {
  constructor() { this.value = ""; this.dataset = {}; this.children = []; this.listeners = {}; this.disabled = false;
    this.textContent = ""; this.atributos = {}; this.files = []; this.classList = { add() {}, remove() {}, toggle() {} }; }
  addEventListener(nome, fn) { this.listeners[nome] = fn; }
  setAttribute(nome, valor) { this.atributos[nome] = valor; }
  getAttribute(nome) { return this.atributos[nome]; }
  setCustomValidity(valor) { this.validade = valor; }
  replaceChildren(...filhos) { this.children = filhos; }
  appendChild(filho) { this.children.push(filho); }
  focus() { this.focado = true; }
  closest() { return { classList: this.classList }; }
}

function prepararFormulario({ edicao = inicial, leaflet = true, comMidias = false } = {}) {
  const elementos = new Map();
  const elemento = nome => { if (!elementos.has(nome)) elementos.set(nome, new Elemento()); return elementos.get(nome); };
  const form = elemento("new-report-form"), botao = elemento("submit");
  form.dataset.inicial = edicao ? JSON.stringify(edicao) : "";
  const radios = { categoria: ["alagamento", "queimada"], severidade: ["Leve", "Moderada", "Grave", "Critica"] };
  for (const [nome, valores] of Object.entries(radios)) radios[nome] = valores.map((valor, indice) => {
    const item = new Elemento(); item.value = valor; item.checked = indice === 0; return item;
  });
  const controles = [botao];
  form.querySelector = () => botao;
  form.querySelectorAll = seletor => {
    const match = seletor.match(/^input\[name="(\w+)"\]$/);
    return match ? radios[match[1]] : [...controles, ...elementos.values(), ...Object.values(radios).flat()];
  };
  form.reportValidity = () => true;
  const pedidos = [], timers = [], visoes = [];
  let responder = async () => ({ ok: true, status: edicao ? 200 : 201,
    json: async () => ({ ok: true, publicId: id, versao: "3", alterado: true, publicado: false }) });
  const nomesCampos = { titulo: "report-title", descricao: "report-description", bairro: "bairro-id",
    latitude: "latitude", longitude: "longitude", referencia: "reference" };
  const mapa = { setView(ponto, zoom) { visoes.push({ ponto, zoom }); return mapa; }, on() {}, getCenter: () => ({ lat: -23, lng: -46 }) };
  const L = { map: () => mapa, tileLayer: () => ({ addTo() {} }),
    marker: () => ({ addTo() { return this; }, on() {}, setLatLng() {} }) };
  const contexto = vm.createContext({
    document: { getElementById: elemento, createElement: () => new Elemento(), querySelectorAll: () => [],
      addEventListener(nome, fn) { if (nome === "DOMContentLoaded") fn(); } },
    window: { L: leaflet ? L : null,
      ClimaFyBairros: { criarAutocompleteBairros: opcoes => ({ fechar() {}, limpar() { opcoes.aoLimpar(); },
        selecionar(bairro) { elemento("neighborhood").value = bairro.nome; opcoes.aoEscolher(bairro); } }) },
      ClimaFyEnderecos: { criarBuscaEndereco: () => ({ fechar() {} }) } },
    L, navigator: {}, AbortController, clearTimeout() {}, setTimeout(fn) { timers.push(fn); return timers.length; },
    FormData: class {
      constructor(formulario) { this.formulario = formulario; this.valores = new Map(); }
      set(nome, valor) { this.valores.set(nome, valor); }
      get(nome) {
      if (this.valores.has(nome)) return this.valores.get(nome);
      if (!this.formulario) return null;
      return radios[nome]?.find(r => r.checked)?.value ?? elemento(nomesCampos[nome]).value;
    } },
    fetch: async (url, opcoes) => {
      pedidos.push({ url, opcoes });
      if (url === "/api/relatos/envio/configuracao") return { ok: true,
        json: async () => ({ csrfToken: csrf, anexos: { disponivel: true } }) };
      return responder({ url, opcoes });
    },
  });
  if (comMidias) vm.runInContext(fs.readFileSync(path.join(__dirname, "../app/public/js/relato-midias.js"), "utf8"), contexto);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../app/public/js/new-report.js"), "utf8"), contexto);
  return { elementos, elemento, form, botao, pedidos, timers, visoes, radios,
    responder(fn) { responder = fn; }, enviar: () => form.listeners.submit({ preventDefault() {} }) };
}

test("edição preenche campos, radios, bairro, contadores e marcador sem geocoding/requisição automática", () => {
  const ui = prepararFormulario();
  assert.equal(ui.elemento("report-title").value, inicial.titulo);
  assert.equal(ui.elemento("report-description").value, inicial.descricao);
  assert.equal(ui.elemento("reference").value, inicial.referencia);
  assert.equal(ui.elemento("bairro-id").value, inicial.bairroId);
  assert.equal(ui.elemento("city").value, inicial.cidade);
  assert.equal(ui.elemento("neighborhood").validade, "");
  assert.equal(ui.radios.severidade.find(r => r.checked).value, "Grave");
  assert.equal(ui.elemento("title-count").textContent, inicial.titulo.length);
  assert.equal(ui.elemento("latitude").value, "-23.5500000");
  assert.equal(ui.visoes.at(-1).ponto.lat, inicial.latitude);
  assert.equal(ui.timers.length, 0); assert.equal(ui.pedidos.length, 0);
});

test("edição envia PUT com versão e CSRF e só confirma após resposta válida", async () => {
  const ui = prepararFormulario(); let concluir;
  ui.responder(() => new Promise(resolve => { concluir = resolve; }));
  const envio = ui.enviar();
  assert.equal(ui.botao.disabled, true); assert.equal(ui.pedidos.length, 1);
  const req = ui.pedidos[0]; assert.equal(req.url, "/api/meus-relatos/" + id);
  assert.equal(req.opcoes.method, "PUT"); assert.equal(req.opcoes.headers["X-CSRF-Token"], csrf);
  assert.equal(JSON.parse(req.opcoes.body).versao, "2");
  assert.equal(JSON.parse(req.opcoes.body).titulo, inicial.titulo);
  await ui.enviar(); assert.equal(ui.pedidos.length, 1);
  concluir({ ok: true, status: 200, json: async () => ({ ok: true, publicId: id, versao: "3", alterado: true }) });
  await envio; assert.equal(ui.botao.textContent, "Alterações salvas");
  assert.match(ui.elemento("form-feedback").children[0].children[0].textContent, /aguarda nova moderação/);
  assert.equal(ui.elemento("form-feedback").children[1].href, "/meus-relatos/" + id);
  await ui.enviar(); assert.equal(ui.pedidos.length, 1);
});

test("salvar sem mudanças não anuncia uma nova revisão", async () => {
  const ui = prepararFormulario();
  ui.responder(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, publicId: id, versao: "2", alterado: false }) }));
  await ui.enviar(); assert.match(ui.elemento("form-feedback").children[0].children[0].textContent, /Nenhuma alteração/);
});

test("erro 409 e falha de rede preservam formulário e não fingem sucesso", async () => {
  const ui = prepararFormulario();
  ui.responder(async () => ({ ok: false, status: 409, json: async () => ({ erro: "A versão mudou. Atualize." }) }));
  await ui.enviar(); assert.equal(ui.elemento("report-title").value, inicial.titulo);
  assert.equal(ui.botao.disabled, false); assert.match(ui.elemento("form-feedback").children[0].children[0].textContent, /versão mudou/);
  ui.responder(async () => { throw new Error("Sem conexão"); }); await ui.enviar();
  assert.match(ui.elemento("form-feedback").children[0].children[0].textContent, /Não conseguimos confirmar a edição/);
});

test("sem Leaflet mantém as coordenadas originais para edição de texto", async () => {
  const ui = prepararFormulario({ leaflet: false });
  assert.equal(ui.elemento("latitude").value, String(inicial.latitude));
  await ui.enviar(); assert.equal(ui.pedidos[0].opcoes.method, "PUT");
});

test("novo relato continua usando POST, sem versão/token de edição", async () => {
  const ui = prepararFormulario({ edicao: null });
  ui.elemento("latitude").value = "-23.55"; ui.elemento("longitude").value = "-46.63";
  await ui.enviar(); const req = ui.pedidos[0];
  assert.equal(req.url, "/api/relatos"); assert.equal(req.opcoes.method, "POST");
  assert.equal(req.opcoes.headers["X-CSRF-Token"], undefined);
  assert.equal(JSON.parse(req.opcoes.body).versao, undefined);
  assert.equal(ui.botao.textContent, "Relato enviado");
});

test("formulário existente conecta módulo de anexos e envia multipart em vez de serializar o arquivo como JSON", async () => {
  const ui = prepararFormulario({ edicao: null, comMidias: true });
  await new Promise(resolve => setImmediate(resolve));
  const input = ui.elemento("photo-upload");
  assert.equal(input.disabled, false);
  const arquivo = { type: "video/mp4", size: 100, name: "teste.mp4" };
  input.files = [arquivo]; input.listeners.change();
  ui.elemento("latitude").value = "-23"; ui.elemento("longitude").value = "-46";
  await ui.enviar();
  const req = ui.pedidos.find(p => p.opcoes.method === "POST");
  assert.equal(req.opcoes.headers["Content-Type"], undefined);
  assert.equal(req.opcoes.headers["X-CSRF-Token"], csrf);
  assert.equal(req.opcoes.body.get("foto"), arquivo);
  assert.equal(req.opcoes.body.get("latitude"), "-23");
  assert.equal(ui.botao.textContent, "Relato enviado");
});

test("falha no multipart mantém a seleção e restaura controles sem reenviar automaticamente", async () => {
  const ui = prepararFormulario({ edicao: null, comMidias: true });
  await new Promise(resolve => setImmediate(resolve));
  const input = ui.elemento("photo-upload"); const arquivo = { type: "image/png", size: 100, name: "teste.png" };
  input.files = [arquivo]; input.listeners.change();
  ui.elemento("latitude").value = "-23"; ui.elemento("longitude").value = "-46";
  ui.responder(async () => ({ ok: false, status: 502, json: async () => ({ erro: "Falha no anexo" }) }));
  await ui.enviar();
  assert.equal(ui.pedidos.filter(p => p.opcoes.method === "POST").length, 1);
  assert.equal(input.disabled, false); assert.equal(ui.botao.disabled, false);
  assert.match(ui.elemento("form-feedback").children[0].children[0].textContent, /Falha no anexo/);
});

function prepararExclusao(confirmacao = true) {
  const mapa = new Elemento(), principal = new Elemento(), botao = new Elemento(), feedback = new Elemento();
  principal.dataset = { publicId: id, versao: "2", csrf }; const pedidos = [], navegacoes = [];
  let responder = async () => ({ ok: true, excluido: true });
  const contexto = vm.createContext({
    document: { querySelector: nome => ({ "#detail-map": mapa, ".report-detail": principal,
      "#delete-report": botao, "#author-feedback": feedback })[nome] ?? null,
      addEventListener(nome, fn) { if (nome === "DOMContentLoaded") fn(); } },
    window: { ClimaFyRelatos: { rotulos: {}, json: async (url, opcoes) => {
      pedidos.push({ url, opcoes }); return responder();
    } }, confirm: () => confirmacao, location: { assign: url => navegacoes.push(url) } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../app/public/js/relato-detalhe.js"), "utf8"), contexto);
  return { botao, feedback, pedidos, navegacoes, responder(fn) { responder = fn; } };
}

test("exclusão exige confirmação explícita e envia versão/CSRF", async () => {
  const cancelado = prepararExclusao(false); await cancelado.botao.listeners.click(); assert.equal(cancelado.pedidos.length, 0);
  const ui = prepararExclusao(); await ui.botao.listeners.click();
  assert.equal(ui.pedidos[0].opcoes.method, "DELETE"); assert.equal(ui.pedidos[0].opcoes.headers["X-CSRF-Token"], csrf);
  assert.deepEqual(JSON.parse(ui.pedidos[0].opcoes.body), { versao: "2" });
  assert.deepEqual(ui.navegacoes, ["/meus-relatos"]);
});

test("exclusão com erro não redireciona nem permite clique duplo durante pedido", async () => {
  const ui = prepararExclusao(); let falhar;
  ui.responder(() => new Promise((resolve, reject) => { falhar = reject; }));
  const primeiro = ui.botao.listeners.click(); await ui.botao.listeners.click(); assert.equal(ui.pedidos.length, 1);
  falhar(new Error("Falha de conexão")); await primeiro;
  assert.equal(ui.navegacoes.length, 0); assert.equal(ui.botao.disabled, false);
  assert.match(ui.feedback.textContent, /não confirmamos a exclusão/);
});
