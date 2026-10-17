// Teste da logica da lista em DOM simulado, sem navegador, banco ou SMTP reais.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Elemento {
  constructor(tag = 'section', valor = '') {
    this.tagName = tag; this.value = valor; this.children = []; this.atributos = {};
    this.listeners = {}; this.dataset = {}; this.innerHTML = ''; this.textContent = '';
    this.style = { setProperty: (nome, valor) => { this.style[nome] = valor; } };
    this.classList = { add: nome => { this.className = nome; }, toggle() {} };
  }
  append(...itens) { this.children.push(...itens); }
  replaceChildren(...itens) { this.children = [...itens]; this.innerHTML = ''; }
  setAttribute(nome, valor) { this.atributos[nome] = valor; }
  addEventListener(nome, fn) { this.listeners[nome] = fn; }
  get options() { return this.children; }
}
function preparar() {
  const elementos = new Map();
  for (const [id, valor] of [
    ['#reports-grid', ''], ['#results-count', ''], ['#category-filter', 'Todas'],
    ['#neighborhood-filter', 'Todos'], ['#period-filter', 'Periodo'],
    ['#report-search', ''], ['#sort-filter', 'recent'], ['.cards-section .pagination', ''],
    ['#featured-grid', ''], ['#neighborhood-ranking', ''], ['.filter-form', ''],
  ]) elementos.set(id, new Elemento('section', valor));
  const tabs = ['Todos', 'Aberto', 'Em andamento', 'Resolvido'].map(status => {
    const button = new Elemento('button'); button.dataset.status = status; return button;
  });
  const requisicoes = [];
  let responder = async () => resposta([]);
  let responderVotos = async () => ({ status: 401, ok: false, json: async () => ({ erro: 'Entre na sua conta.' }) });
  const navegacoes = [];
  const contexto = vm.createContext({
    document: { querySelector: id => elementos.get(id), querySelectorAll: () => tabs, createElement: tag => new Elemento(tag) },
    window: { location: { pathname: '/relatos', search: '', assign: url => navegacoes.push(url) } },
    URLSearchParams, AbortController, setTimeout, clearTimeout, console,
    fetch: async (url, options) => {
      const chamada = { url, options }; requisicoes.push(chamada);
      if (url.startsWith('/api/votos?') || url.endsWith('/voto')) return responderVotos(chamada);
      return responder(chamada);
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js/relatos.js'), 'utf8'), contexto);
  return { contexto, elementos, tabs, requisicoes, navegacoes, responder(fn) { responder = fn; },
    responderVotos(fn) { responderVotos = fn; } };
}
function requisicoesLista(ui) { return ui.requisicoes.filter(r => r.url.startsWith('/api/relatos?')); }
function resposta(relatos, pagina = 1, total = relatos.length, paginas = total ? 1 : 0) {
  return { ok: true, json: async () => ({ relatos, paginacao: { pagina, total, paginas },
    filtros: { categorias: [{ slug: 'alagamento', nome: 'Alagamento' }], bairros: [{ id: 85, nome: 'Consolação' }] } }) };
}
const relato = { publicId: '2773767c-ac48-4ffd-9a39-7866fff3f860',
  titulo: 'TEste <img src=x onerror=alert(1)>', descricao: '<script>alert(1)</script>',
  categoria: 'Alagamento', categoriaSlug: 'alagamento', bairro: 'Consolação', status: 'aberto',
  criadoEm: '2026-10-02T18:36:05.000Z', votos: 0 };
const proximoTick = () => new Promise(resolve => setImmediate(resolve));

test('lista principal usa API com o card original sem alterar blocos de demonstracao', async () => {
  const ui = preparar(); await proximoTick();
  const destaques = ui.elementos.get('#featured-grid').innerHTML;
  const bairros = ui.elementos.get('#neighborhood-ranking').innerHTML;
  ui.responder(async () => resposta([relato])); await ui.contexto.renderCards();
  const grid = ui.elementos.get('#reports-grid'); const artigo = grid.children[0];
  assert.equal(artigo.className, 'report-card'); assert.equal(artigo.style['--accent'], '#2469d6');
  const conteudo = artigo.children[0]; assert.equal(conteudo.className, 'report-card-inner');
  assert.equal(conteudo.children[1].textContent, relato.titulo);
  assert.equal(conteudo.children[2].textContent, relato.descricao);
  assert.equal(conteudo.children[1].innerHTML, '');
  assert.equal(conteudo.children[3].children[3].href, '/relatos/' + relato.publicId);
  assert.equal(ui.elementos.get('#results-count').textContent, '1 relato encontrado');
  assert.equal(ui.elementos.get('#featured-grid').innerHTML, destaques);
  assert.equal(ui.elementos.get('#neighborhood-ranking').innerHTML, bairros);
  assert.equal(new URL(requisicoesLista(ui).at(-1).url, 'http://teste').pathname, '/api/relatos');
});
test('filtros enviam slugs e IDs no contrato do backend', async () => {
  const ui = preparar(); await proximoTick();
  ui.elementos.get('#category-filter').value = 'alagamento';
  ui.elementos.get('#neighborhood-filter').value = '85';
  ui.elementos.get('#period-filter').value = '7 dias';
  ui.elementos.get('#sort-filter').value = 'votes';
  ui.elementos.get('#report-search').value = '  TEste  ';
  ui.tabs[3].listeners.click(); await proximoTick();
  const parametros = new URL(requisicoesLista(ui).at(-1).url, 'http://teste').searchParams;
  assert.deepEqual(Object.fromEntries(parametros), { pagina: '1', ordem: 'votes', status: 'resolvido',
    categoria: 'alagamento', bairro: '85', dias: '7', busca: 'TEste' });
});
test('paginacao usa quantidade real e navega na API sem mudar de pagina HTML', async () => {
  const ui = preparar(); await proximoTick();
  ui.responder(async chamada => resposta([relato], Number(new URL(chamada.url, 'http://teste').searchParams.get('pagina')), 13, 2));
  await ui.contexto.renderCards();
  const nav = ui.elementos.get('.cards-section .pagination');
  assert.equal(nav.children[0].atributos['aria-disabled'], 'true');
  let prevenido = false;
  nav.children.at(-1).listeners.click({ preventDefault() { prevenido = true; } }); await proximoTick();
  assert.equal(prevenido, true);
  assert.equal(new URL(requisicoesLista(ui).at(-1).url, 'http://teste').searchParams.get('pagina'), '2');
  assert.equal(nav.children.at(-1).atributos['aria-disabled'], 'true');
});
test('lista vazia nunca volta aos cards ficticios', async () => {
  const ui = preparar(); await proximoTick();
  const grid = ui.elementos.get('#reports-grid');
  assert.equal(grid.children.length, 1); assert.equal(grid.children[0].tagName, 'p');
  assert.equal(grid.children[0].textContent, 'Nenhum relato publicado corresponde à busca.');
  assert.equal(ui.elementos.get('.cards-section .pagination').children.length, 0);
});
test('falha mostra erro e permite tentar novamente', async () => {
  const ui = preparar(); await proximoTick();
  ui.responder(async () => ({ ok: false, json: async () => ({ erro: 'Erro interno do servidor' }) }));
  await ui.contexto.renderCards();
  const grid = ui.elementos.get('#reports-grid'); assert.equal(grid.children[0].textContent, 'Erro interno do servidor');
  const tentar = grid.children[1]; assert.equal(tentar.textContent, 'Tentar novamente');
  ui.responder(async () => resposta([relato])); tentar.listeners.click(); await proximoTick();
  assert.equal(grid.children[0].className, 'report-card'); assert.equal(grid.atributos['aria-busy'], 'false');
});
test('resposta antiga nao sobrescreve a busca mais recente', async () => {
  const ui = preparar(); await proximoTick();
  let antiga, recente;
  ui.responder(chamada => new Promise(resolve => {
    if (new URL(chamada.url, 'http://teste').searchParams.get('pagina') === '1') antiga = resolve;
    else recente = resolve;
  }));
  const primeira = ui.contexto.renderCards(1); const segunda = ui.contexto.renderCards(2);
  recente(resposta([{ ...relato, titulo: 'Busca atual' }], 2, 13, 2)); await segunda;
  antiga(resposta([{ ...relato, titulo: 'Busca antiga' }], 1, 13, 2)); await primeira;
  assert.equal(ui.elementos.get('#reports-grid').children[0].children[0].children[1].textContent, 'Busca atual');
  assert.equal(requisicoesLista(ui).at(-2).options.signal.aborted, true);
});

const csrf = 'a'.repeat(64);
const estado = { publicId: relato.publicId, votos: 0, votado: false, proprio: false, podeVotar: true };
function respostaVotos(voto = estado) {
  return { ok: true, status: 200, json: async () => ({ votos: [voto], csrfToken: csrf }) };
}
async function listaComVotos(responderVotos) {
  const ui = preparar(); await proximoTick();
  ui.responderVotos(responderVotos); ui.responder(async () => resposta([relato]));
  await ui.contexto.renderCards(); await proximoTick();
  ui.botao = ui.elementos.get('#reports-grid').children[0].children[0].children[3].children[2];
  ui.feedback = ui.elementos.get('#reports-grid').children[0].children[0].children[4];
  return ui;
}

test('visitante é encaminhado ao login só quando tenta votar', async () => {
  const ui = await listaComVotos(async () => ({ ok: false, status: 401 }));
  assert.equal(ui.botao.tagName, 'button'); assert.equal(ui.botao.className, 'votes');
  assert.equal(ui.botao.disabled, false); assert.equal(ui.navegacoes.length, 0);
  await ui.botao.listeners.click();
  assert.deepEqual(ui.navegacoes, ['/login?proximo=%2Frelatos']);
  assert.equal(ui.requisicoes.filter(r => r.url.endsWith('/voto')).length, 0);
});

test('não oferece voto no próprio relato nem em publicação que saiu do ar', async () => {
  const ui = await listaComVotos(async () => respostaVotos({ ...estado, proprio: true, podeVotar: false }));
  assert.equal(ui.botao.disabled, true); assert.match(ui.botao.title, /próprio relato/);
  await ui.botao.listeners.click(); assert.equal(ui.requisicoes.filter(r => r.url.endsWith('/voto')).length, 0);
  ui.responderVotos(async () => ({ ok: true, status: 200, json: async () => ({ votos: [], csrfToken: csrf }) }));
  await ui.contexto.renderCards(); await proximoTick();
  const botao = ui.elementos.get('#reports-grid').children[0].children[0].children[3].children[2];
  assert.equal(botao.disabled, true); assert.match(botao.title, /mais publicado/);
});

test('PUT/DELETE usam CSRF; contador só muda após confirmação e clique duplo não duplica', async () => {
  let concluir;
  const ui = await listaComVotos(async r => r.url.startsWith('/api/votos?') ? respostaVotos()
    : new Promise(resolve => { concluir = resolve; }));
  const primeiro = ui.botao.listeners.click(); await proximoTick();
  assert.equal(ui.botao.disabled, true); assert.equal(ui.botao.textContent, '▲ 0');
  await ui.botao.listeners.click();
  assert.equal(ui.requisicoes.filter(r => r.url.endsWith('/voto')).length, 1);
  const pedido = ui.requisicoes.at(-1);
  assert.equal(pedido.options.method, 'PUT'); assert.equal(pedido.options.headers['X-CSRF-Token'], csrf);
  assert.equal(pedido.options.body, '{}');
  concluir({ ok: true, json: async () => ({ ok: true, voto: { ...estado, votado: true, votos: 1 } }) });
  await primeiro; await proximoTick();
  assert.equal(ui.botao.textContent, '▲ 1'); assert.equal(ui.botao.atributos['aria-pressed'], 'true');
  assert.equal(ui.feedback.textContent, 'Voto registrado.');
  ui.responderVotos(async () => ({ ok: true, json: async () => ({ ok: true, voto: estado }) }));
  await ui.botao.listeners.click(); await proximoTick();
  assert.equal(ui.requisicoes.at(-1).options.method, 'DELETE');
  assert.equal(ui.botao.textContent, '▲ 0'); assert.equal(ui.botao.atributos['aria-pressed'], 'false');
});

test('voto perdido na rede exige consultar estado antes de permitir nova alteração', async () => {
  const ui = await listaComVotos(async r => {
    if (r.url.startsWith('/api/votos?')) return respostaVotos();
    throw new Error('Falha de conexão');
  });
  await ui.botao.listeners.click(); await proximoTick();
  assert.equal(ui.botao.textContent, '▲ 0'); assert.match(ui.feedback.textContent, /consultar o estado/);
  ui.responderVotos(async () => respostaVotos({ ...estado, votado: true, votos: 1 }));
  await ui.botao.listeners.click(); await proximoTick();
  assert.equal(ui.botao.textContent, '▲ 1'); assert.equal(ui.botao.atributos['aria-pressed'], 'true');
  assert.equal(ui.requisicoes.filter(r => r.url.endsWith('/voto')).length, 1);
});

test('falha ou estado malformado da API de votos não apaga os cards nem inventa confirmação', async () => {
  const ui = await listaComVotos(async () => respostaVotos({ ...estado, votos: -1 }));
  assert.equal(ui.elementos.get('#reports-grid').children[0].className, 'report-card');
  assert.equal(ui.botao.textContent, '▲ 0'); assert.equal(ui.botao.disabled, false);
  assert.match(ui.feedback.textContent, /Não foi possível consultar/);
  ui.responderVotos(async () => respostaVotos()); await ui.botao.listeners.click(); await proximoTick();
  ui.responderVotos(async () => ({ ok: true, json: async () => ({ ok: true, voto: { ...estado, publicId: 'outro' } }) }));
  await ui.botao.listeners.click(); await proximoTick();
  assert.equal(ui.botao.textContent, '▲ 0'); assert.match(ui.feedback.textContent, /Resposta inválida/);
});
test('paginacao malformada e recusada sem inventar cards', async () => {
  const ui = preparar(); await proximoTick();
  ui.responder(async () => ({ ok: true, json: async () => ({ relatos: [relato], paginacao: { total: -1 },
    filtros: { categorias: [], bairros: [] } }) }));
  await ui.contexto.renderCards();
  assert.equal(ui.elementos.get('#reports-grid').children[0].textContent, 'Paginação inválida ao carregar os relatos.');
});
