const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const id = "12345678-1234-4234-8234-123456789abc";
const csrf = "a".repeat(64);
class Elemento {
  constructor(tag = "section") { this.tagName = tag; this.listeners = {}; this.children = []; this.dataset = {};
    this.style = {}; this.atributos = {}; this.textContent = ""; this.disabled = false; this.files = []; this.value = ""; }
  addEventListener(nome, fn) { this.listeners[nome] = fn; }
  setAttribute(nome, valor) { this.atributos[nome] = valor; }
  getAttribute(nome) { return this.atributos[nome]; }
  setCustomValidity(valor) { this.validade = valor; }
  appendChild(filho) { this.children.push(filho); }
  replaceChildren(...filhos) { this.children = filhos; }
}
function preparar(responder) {
  const chamadas = [];
  const urls = [], revogadas = [], eventos = {};
  class Dados { constructor() { this.valores = new Map(); } set(k, v) { this.valores.set(k, v); } get(k) { return this.valores.get(k); } }
  const contexto = vm.createContext({ window: {
    URL: { createObjectURL(arquivo) { const url = `blob:teste-${urls.length}`; urls.push({ arquivo, url }); return url; },
      revokeObjectURL(url) { revogadas.push(url); } },
    addEventListener(nome, fn) { eventos[nome] = fn; },
  }, FormData: Dados,
    document: { createElement: tag => new Elemento(tag) },
    fetch: async (url, opcoes) => { chamadas.push({ url, opcoes }); return responder(url, opcoes); },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../app/public/js/relato-midias.js"), "utf8"), contexto);
  const opcoes = Object.fromEntries(["form", "input", "zona", "feedback", "remover", "titulo", "ajuda", "previa"].map(n => [n, new Elemento()]));
  opcoes.previa.hidden = true;
  return { api: contexto.window.ClimaFyMidias, chamadas, opcoes, urls, revogadas, eventos };
}
const config = (disponivel = true) => ({ ok: true, json: async () => ({ csrfToken: csrf, anexos: { disponivel } }) });
const foto = { type: "image/png", size: 100, name: '<img src=x onerror="alert(1)">' };

test("foto selecionada mostra miniatura local de 160px sem enviar bytes nem alterar arquivo", async () => {
  const ui = preparar(() => config()); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  assert.equal(ui.opcoes.previa.hidden, true);
  ui.opcoes.input.files = [foto]; ui.opcoes.input.listeners.change();
  assert.equal(ui.opcoes.previa.hidden, false);
  const [imagem, legenda] = ui.opcoes.previa.children;
  assert.equal(imagem.tagName, "img"); assert.equal(imagem.width, 160); assert.equal(imagem.height, 160);
  assert.equal(imagem.style.objectFit, "contain"); assert.equal(imagem.src, ui.urls[0].url);
  assert.ok(imagem.alt); assert.equal(legenda.textContent, foto.name); assert.equal(legenda.innerHTML, undefined);
  assert.equal(ui.urls[0].arquivo, foto); assert.equal(componente.preparar({}).body.get("foto"), foto);
  assert.equal(ui.chamadas.length, 1, "só consulta configuração, não envia imagem ao selecionar");
});

test("troca/remoção revogam URLs locais, não acumulam miniaturas e voltam à criação sem arquivo", async () => {
  const ui = preparar(() => config()); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  ui.opcoes.input.files = [foto]; ui.opcoes.input.listeners.change();
  const antiga = ui.urls[0].url;
  const outra = { ...foto, name: "outra.png" };
  ui.opcoes.zona.listeners.drop({ preventDefault() {}, dataTransfer: { files: [outra] } });
  assert.equal(ui.opcoes.previa.children.length, 2);
  assert.equal(ui.opcoes.previa.children[1].textContent, "outra.png");
  assert.ok(ui.revogadas.includes(antiga));
  ui.opcoes.remover.listeners.click();
  assert.equal(ui.opcoes.previa.hidden, true); assert.equal(ui.opcoes.previa.children.length, 0);
  assert.equal(ui.revogadas.length, 2); assert.equal(componente.preparar({}).headers["Content-Type"], "application/json");
});

test("arquivo inválido ou vídeo limpa prévia de foto sem tentar tratá-lo como imagem", async () => {
  const ui = preparar(() => config()); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  ui.opcoes.input.files = [foto]; ui.opcoes.input.listeners.change();
  ui.opcoes.input.files = [{ ...foto, size: 5242881 }]; ui.opcoes.input.listeners.change();
  assert.equal(ui.opcoes.previa.hidden, true); assert.equal(ui.urls.length, 1);
  const video = { type: "video/mp4", size: 100, name: "teste.mp4" };
  ui.opcoes.input.files = [video]; ui.opcoes.input.listeners.change();
  assert.equal(ui.opcoes.previa.hidden, true); assert.equal(ui.urls.length, 1);
  assert.equal(componente.preparar({}).body.get("foto"), video);
});

test("erro de leitura de foto atual recusa seleção; erro atrasado de miniatura anterior não apaga a nova", async () => {
  const ui = preparar(() => config()); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  ui.opcoes.input.files = [foto]; ui.opcoes.input.listeners.change();
  const primeira = ui.opcoes.previa.children[0];
  ui.opcoes.input.files = [{ ...foto, name: "segunda.png" }]; ui.opcoes.input.listeners.change();
  const segunda = ui.opcoes.previa.children[0];
  primeira.listeners.error(); assert.equal(ui.opcoes.previa.children[0], segunda);
  segunda.listeners.error();
  assert.equal(ui.opcoes.previa.hidden, true); assert.match(ui.opcoes.input.validade, /Não foi possível abrir/);
  ui.opcoes.remover.listeners.click(); assert.equal(ui.opcoes.input.validade, "");
});

test("saída da página libera URL de memória; retorno pelo histórico recria miniatura da mesma seleção", async () => {
  const ui = preparar(() => config()); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  ui.opcoes.input.files = [foto]; ui.opcoes.input.listeners.change();
  ui.eventos.pagehide(); assert.equal(ui.revogadas.length, 1); assert.equal(ui.opcoes.previa.hidden, true);
  ui.eventos.pageshow({ persisted: true }); assert.equal(ui.opcoes.previa.hidden, false); assert.equal(ui.urls.length, 2);
  assert.equal(componente.preparar({}).body.get("foto"), foto);
});

test("campo inicia desabilitado e só habilita após obter configuração/CSRF válidos", async () => {
  let concluir;
  const ui = preparar(() => new Promise(resolve => { concluir = resolve; }));
  const componente = ui.api.configurarEnvio(ui.opcoes);
  assert.equal(ui.opcoes.input.disabled, true);
  assert.equal(ui.chamadas[0].url, "/api/relatos/envio/configuracao");
  concluir(config()); await componente.pronto;
  assert.equal(ui.opcoes.input.disabled, false);
  assert.equal(ui.chamadas[0].opcoes.credentials, "same-origin");
});

test("seleção gera multipart com arquivo real e CSRF, sem Content-Type manual; remoção volta a JSON", async () => {
  const ui = preparar(() => config());
  const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  ui.opcoes.input.files = [foto]; ui.opcoes.input.listeners.change();
  const envio = componente.preparar({ titulo: "Teste", bairro: "3" });
  assert.equal(envio.body.get("foto"), foto);
  assert.equal(envio.body.get("titulo"), "Teste");
  assert.equal(envio.headers["X-CSRF-Token"], csrf);
  assert.equal(envio.headers["Content-Type"], undefined);
  assert.ok(ui.opcoes.feedback.textContent.includes(foto.name));
  assert.equal(ui.opcoes.feedback.innerHTML, undefined);
  ui.opcoes.remover.listeners.click();
  const json = componente.preparar({ titulo: "Teste" });
  assert.equal(json.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(json.body), { titulo: "Teste" });
});

test("arrastar vídeo envia o objeto arrastado, mesmo sem alterar o FileList do input", async () => {
  const ui = preparar(() => config()); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  const video = { name: "teste.mp4", type: "video/mp4", size: 200 };
  let prevenido = false;
  ui.opcoes.zona.listeners.drop({ preventDefault() { prevenido = true; }, dataTransfer: { files: [video] } });
  assert.equal(prevenido, true);
  assert.equal(ui.opcoes.input.files.length, 0);
  assert.equal(componente.preparar({}).body.get("foto"), video);
});

test("tipo, vazio, tamanho e múltiplos arquivos geram erro de validação removível", async () => {
  const ui = preparar(() => config()); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
  for (const arquivos of [[{ ...foto, size: 0 }], [{ ...foto, size: 5242881 }], [{ ...foto, type: "image/svg+xml" }], [foto, foto]]) {
    ui.opcoes.input.files = arquivos; ui.opcoes.input.listeners.change();
    assert.match(ui.opcoes.input.validade, /único arquivo/);
    assert.equal(ui.opcoes.remover.hidden, false);
    ui.opcoes.remover.listeners.click();
    assert.equal(ui.opcoes.input.validade, "");
    assert.equal(componente.preparar({}).headers["Content-Type"], "application/json");
  }
});

test("configuração indisponível/falha mantém criação sem arquivo e não habilita o input", async () => {
  for (const responder of [() => config(false), () => { throw new Error("sem rede"); }, () => ({ ok: false, json: async () => ({}) })]) {
    const ui = preparar(responder); const componente = ui.api.configurarEnvio(ui.opcoes); await componente.pronto;
    assert.equal(ui.opcoes.input.disabled, true);
    assert.match(ui.opcoes.feedback.textContent, /sem arquivo/);
    assert.equal(componente.preparar({}).headers["Content-Type"], "application/json");
  }
});

test("edição não solicita configuração e mantém anexos antigos sem enviar novo arquivo", async () => {
  const ui = preparar(() => { throw new Error("Não deveria consultar"); });
  const componente = ui.api.configurarEnvio({ ...ui.opcoes, edicao: { versao: "2" } }); await componente.pronto;
  assert.equal(ui.chamadas.length, 0); assert.equal(ui.opcoes.input.disabled, true);
  assert.match(ui.opcoes.titulo.textContent, /mantidos/);
  assert.equal(JSON.parse(componente.preparar({ versao: "2" }).body).versao, "2");
});

test("configuração tardia não reabilita input durante envio; atualização restaura ao terminar", async () => {
  let concluir; const ui = preparar(() => new Promise(resolve => { concluir = resolve; }));
  const componente = ui.api.configurarEnvio(ui.opcoes);
  ui.opcoes.form.setAttribute("aria-busy", "true"); concluir(config()); await componente.pronto;
  assert.equal(ui.opcoes.input.disabled, true);
  ui.opcoes.form.setAttribute("aria-busy", "false"); componente.atualizar();
  assert.equal(ui.opcoes.input.disabled, false);
});

function secao(base) {
  const alvo = new Elemento(); const lista = new Elemento(); const feedback = new Elemento();
  alvo.dataset.midiasUrl = base;
  alvo.querySelector = nome => nome === "[data-midia-lista]" ? lista : feedback;
  return { alvo, lista, feedback };
}
function midia(base, tipo = "foto") {
  return { id: "1", tipo, mimeType: tipo === "foto" ? "image/png" : "video/mp4", tamanhoBytes: 100, url: base + "/1" };
}

test("detalhes público/autor/moderador usam seus endpoints e exibem imagem/vídeo sem autoplay", async () => {
  for (const prefixo of ["relatos", "meus-relatos", "adm/relatos"]) {
    const base = `/api/${prefixo}/${id}/midias`;
    const ui = preparar(() => ({ ok: true, json: async () => ({ midias: [midia(base), { ...midia(base, "video"), id: "2", url: base + "/2" }] }) }));
    const s = secao(base); await ui.api.carregarAnexos(s.alvo);
    assert.equal(ui.chamadas[0].url, base);
    assert.equal(s.lista.children.length, 2);
    const img = s.lista.children[0].children[0], video = s.lista.children[1].children[0];
    assert.equal(img.tagName, "img"); assert.equal(img.loading, "lazy"); assert.ok(img.alt);
    assert.equal(video.tagName, "video"); assert.equal(video.controls, true); assert.equal(video.preload, "none");
    assert.equal(video.autoplay, undefined); assert.equal(img.src, base + "/1");
    img.listeners.error(); assert.match(s.lista.children[0].children[1].textContent, /Não foi possível carregar/);
  }
});

test("lista vazia é distinta de erro: consulta negada ou URL remota não vira ausência de anexos", async () => {
  const base = `/api/relatos/${id}/midias`;
  const vazio = preparar(() => ({ ok: true, json: async () => ({ midias: [] }) }));
  const s = secao(base); await vazio.api.carregarAnexos(s.alvo);
  assert.match(s.feedback.textContent, /não tem anexos/);
  for (const resposta of [{ ok: false, json: async () => ({ erro: "Sem acesso" }) },
    { ok: true, json: async () => ({ midias: [{ ...midia(base), url: "https://outro/segredo" }] }) },
    { ok: true, json: async () => ({ midias: [{ ...midia(base), mimeType: "text/html" }] }) }]) {
    const ui = preparar(() => resposta); const alvo = secao(base); await ui.api.carregarAnexos(alvo.alvo);
    assert.equal(alvo.lista.children.length, 0);
    assert.match(alvo.feedback.textContent, /Não foi possível consultar/);
  }
});
