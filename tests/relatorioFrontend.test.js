// Testes de integração em DOM simulado, sem navegador ou download real.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
class Elemento {
  constructor(tag = 'section') { this.tag = tag; this.children = []; this.listeners = {}; this.disabled = true; this.value = ''; this._texto = ''; }
  set textContent(t) { this._texto = String(t); this.children = []; }
  get textContent() { return this._texto + this.children.map(c => c.textContent).join(''); }
  set innerHTML(v) { throw new Error('Não inserir dados em HTML: ' + v); }
  append(...itens) { this.children.push(...itens); }
  replaceChildren(...itens) { this._texto = ''; this.children = itens; }
  addEventListener(nome, fn) { this.listeners[nome] = fn; }
  click() { this.clicado = true; }
  remove() { this.removido = true; }
}
const filtros = { categorias: [{ slug: 'alagamento', nome: '<img src=x onerror=alert(1)>' }],
  bairros: [{ id: 85, nome: 'Consolação', cidade: 'São Paulo' }], limite: 5000 };
function json(corpo, status = 200) { return { ok: status < 400, status, json: async () => corpo }; }
function arquivo({ total = '1', tipo = 'text/csv; charset=utf-8', tamanho = 300, data = '2026-10-16T18:30:00Z' } = {}) {
  return { ok: true, headers: new Headers({ 'content-type': tipo, 'X-Relatos-Total': total, 'X-Gerado-Em': data }), blob: async () => ({ size: tamanho }) };
}
function preparar({ metadados = json(filtros), resposta = arquivo() } = {}) {
  const elementos = new Map(), pedidos = [], links = [], urls = [], revogados = [], timers = [];
  const elemento = seletor => { if (!elementos.has(seletor)) elementos.set(seletor, new Elemento()); return elementos.get(seletor); };
  elemento('#export-period').value = '30';
  let meta = metadados, responder = async () => resposta;
  const contexto = vm.createContext({
    document: { querySelector: elemento, body: { append(l) { links.push(l); } }, createElement: tag => new Elemento(tag) },
    URLSearchParams, Date, URL: { createObjectURL(blob) { urls.push(blob); return 'blob:teste'; }, revokeObjectURL(url) { revogados.push(url); } },
    setTimeout(fn, ms) { timers.push({ fn, ms }); },
    fetch: async (url, opcoes) => { pedidos.push({ url, opcoes }); return url.endsWith('/filtros') ? meta : responder(); },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js/adm-relatorios.js'), 'utf8'), contexto);
  return { elemento, pedidos, links, urls, revogados, timers,
    enviar: () => elemento('#report-export-form').listeners.submit({ preventDefault() {} }),
    tick: () => new Promise(resolve => setImmediate(resolve)),
    responder(fn) { responder = fn; }, metadados(v) { meta = v; } };
}
test('filtros reais são inseridos como texto e habilitam o botão sem gerar arquivo automaticamente', async () => {
  const ui = preparar(); assert.equal(ui.elemento('#export-reports').disabled, true); await ui.tick();
  assert.equal(ui.elemento('#export-reports').disabled, false); assert.equal(ui.pedidos.length, 1);
  assert.equal(ui.elemento('#export-category').children[1].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(ui.elemento('#export-neighborhood').children[1].textContent, 'Consolação — São Paulo');
  assert.equal(ui.links.length, 0); assert.equal(ui.pedidos[0].opcoes.credentials, 'same-origin');
});
test('falha nos filtros mantém exportação desabilitada e permite tentar novamente', async () => {
  const ui = preparar({ metadados: json({ erro: 'Acesso restrito' }, 403) }); await ui.tick();
  assert.equal(ui.elemento('#export-reports').disabled, true); await ui.enviar(); assert.equal(ui.pedidos.length, 1);
  assert.match(ui.elemento('#export-feedback').textContent, /Acesso restrito/);
  ui.metadados(json(filtros)); await ui.elemento('#export-feedback').children[0].listeners.click();
  assert.equal(ui.elemento('#export-reports').disabled, false);
});
test('submit envia filtros, evita duplo clique e só solicita download após CSV válido', async () => {
  const ui = preparar(); await ui.tick(); let concluir;
  ui.responder(() => new Promise(resolve => { concluir = resolve; }));
  ui.elemento('#export-period').value = '7'; ui.elemento('#export-category').value = 'alagamento';
  ui.elemento('#export-neighborhood').value = '85'; ui.elemento('#export-status').value = 'aberto';
  const envio = ui.enviar(); await ui.enviar(); assert.equal(ui.pedidos.length, 2); assert.equal(ui.links.length, 0);
  assert.equal(ui.elemento('#export-reports').disabled, true);
  const q = new URLSearchParams(ui.pedidos[1].url.split('?')[1]);
  assert.deepEqual(Object.fromEntries(q), { dias: '7', categoria: 'alagamento', bairro: '85', status: 'aberto' });
  concluir(arquivo()); await envio;
  assert.equal(ui.links.length, 1); assert.equal(ui.links[0].clicado, true); assert.equal(ui.links[0].removido, true);
  assert.equal(ui.links[0].download, 'climafy-relatos-2026-10-16.csv');
  assert.equal(ui.revogados.length, 0); ui.timers[0].fn(); assert.deepEqual(ui.revogados, ['blob:teste']);
  assert.equal(ui.elemento('#export-reports').disabled, false); assert.match(ui.elemento('#export-feedback').textContent, /Download solicitado ao navegador/);
});
test('erro de volume não cria arquivo e preserva os filtros para corrigir consulta', async () => {
  const ui = preparar({ resposta: json({ erro: 'Reduza o período ou selecione outros filtros.' }, 422) }); await ui.tick();
  ui.elemento('#export-period').value = 'todos'; await ui.enviar();
  assert.match(ui.elemento('#export-feedback').textContent, /Reduza o período/); assert.equal(ui.links.length, 0);
  assert.equal(ui.elemento('#export-period').value, 'todos'); assert.equal(ui.elemento('#export-reports').disabled, false);
});
test('falha de rede não anuncia geração, não repete GET automaticamente e permite nova solicitação', async () => {
  const ui = preparar(); await ui.tick(); ui.responder(async () => { throw new Error('Falha de conexão'); }); await ui.enviar();
  assert.equal(ui.links.length, 0); assert.equal(ui.pedidos.length, 2); assert.match(ui.elemento('#export-feedback').textContent, /Falha de conexão/);
  ui.responder(async () => arquivo()); await ui.enviar(); assert.equal(ui.links.length, 1);
});
test('resposta HTML, metadados inválidos e arquivo vazio/grande não viram download', async () => {
  for (const parametros of [{ tipo: 'text/html' }, { total: '5001' }, { total: 'NaN' }, { data: 'inválida' }, { tamanho: 0 }, { tamanho: 11 * 1024 * 1024 }]) {
    const ui = preparar({ resposta: arquivo(parametros) }); await ui.tick(); await ui.enviar();
    assert.equal(ui.links.length, 0, JSON.stringify(parametros)); assert.equal(ui.elemento('#export-reports').disabled, false);
    assert.doesNotMatch(ui.elemento('#export-feedback').textContent, /Download solicitado/);
  }
});
test('consulta sem registros permite cabeçalho CSV e explica resultado vazio', async () => {
  const ui = preparar({ resposta: arquivo({ total: '0' }) }); await ui.tick(); await ui.enviar();
  assert.equal(ui.links.length, 1); assert.match(ui.elemento('#export-feedback').textContent, /somente o cabeçalho/);
});
