// DOM simulado: verifica integração e estados; não substitui inspeção visual no navegador.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', csrf = 'a'.repeat(64);
class Elemento {
  constructor(tag = 'section') {
    this.tag = tag; this.children = []; this.listeners = {}; this.disabled = false; this.value = ''; this.attributes = {};
    this._texto = ''; this.style = { setProperty(nome, valor) { this[nome] = valor; } };
    this.classes = new Set(); this.classList = { remove: c => this.classes.delete(c), toggle: (c, ativo) => ativo ? this.classes.add(c) : this.classes.delete(c) };
  }
  set textContent(texto) { this._texto = String(texto); this.children = []; }
  get textContent() { return this._texto + this.children.map(c => c.textContent).join(''); }
  set innerHTML(valor) { throw new Error('Não interpolar dados em HTML: ' + valor); }
  append(...itens) { this.children.push(...itens); }
  replaceChildren(...itens) { this._texto = ''; this.children = itens; }
  setAttribute(chave, valor) { this.attributes[chave] = valor; }
  addEventListener(nome, fn) { this.listeners[nome] = fn; }
}
function usuarios({ pagina = 1, paginas = 1, total = 1, linhas } = {}) {
  return { usuarios: linhas ?? [{ publicId: id, nome: '<img src=x onerror=alert(1)>', sobrenome: 'Teste',
    email: 'teste@example.com', papel: 'cidadao', status: 'ativo', emailVerificado: false,
    criadoEm: '2026-10-16T12:00:00Z', relatos: 0, podeAlterarStatus: true }],
  resumo: { total, ativos: 0, bloqueados: 0, novosMes: 1, novosSemana: 1, novosSemanaAnterior: 0 },
  paginacao: { pagina, limite: 20, total, paginas }, csrfToken: csrf };
}
function dashboard() {
  return { resumo: { relatosAtivos: 1, pendentes: 1, aprovadosMes: 0, rejeitadosMes: 0, cidadesComRelatos: 1 },
    fila: [{ publicId: id, titulo: '<script>alert(1)</script>', categoria: 'Alagamento', categoriaSlug: 'alagamento',
      bairro: 'Brás', criadoEm: '2026-10-16T12:00:00Z' }],
    atividades: [{ tipo: 'criacao', titulo: '<script>alert(1)</script>', ocorridoEm: '2026-10-16T12:00:00Z' }],
    dias: Array.from({ length: 14 }, (_, i) => ({ data: '2026-10-' + String(i + 3).padStart(2, '0'), total: 0 })),
    categorias: [{ slug: 'alagamento', nome: 'Alagamento', total: 1 }], totalPeriodo: 0, atualizadoEm: '2026-10-16T12:30:00Z' };
}
function resposta(corpo, status = 200) { return { ok: status < 400, status, json: async () => corpo }; }
function preparar(nome, responder) {
  const elementos = new Map(), criados = [], pedidos = [], timers = new Map(), destinos = [];
  let numeroTimer = 0, confirmar = true;
  const elemento = seletor => {
    if (!elementos.has(seletor)) elementos.set(seletor, new Elemento(seletor === '#area-search' ? 'input' : seletor === '#area-status' ? 'select' : 'section'));
    return elementos.get(seletor);
  };
  const contexto = vm.createContext({
    document: { querySelector: elemento, getElementById: id => elemento('#' + id),
      createElement(tag) { const e = new Elemento(tag); criados.push(e); return e; },
      querySelectorAll: () => [...elementos.values(), ...criados].filter(e => ['button', 'input', 'select'].includes(e.tag)) },
    window: { confirm: () => confirmar, location: { assign: url => destinos.push(url) } },
    Intl, Date, URLSearchParams, AbortController, encodeURIComponent,
    setTimeout(fn) { const n = ++numeroTimer; timers.set(n, fn); return n; }, clearTimeout(n) { timers.delete(n); },
    fetch: async (url, opcoes) => { pedidos.push({ url, opcoes }); return responder(url, opcoes); },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js/' + nome), 'utf8'), contexto);
  return { elemento, pedidos, destinos, timers, confirmar(v) { confirmar = v; },
    botoes: () => elemento('#area-table-body').children.flatMap(tr => tr.children.at(-1).children[0].children),
    tick: () => new Promise(resolve => setImmediate(resolve)) };
}

test('usuários: dados textuais seguros, pendência de e-mail e perfil sem ação fictícia', async () => {
  const ui = preparar('adm-usuarios.js', async () => resposta(usuarios())); await ui.tick();
  assert.match(ui.elemento('#area-table-body').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(ui.elemento('#area-table-body').textContent, /Pendente/);
  assert.equal(ui.botoes()[0].disabled, true); assert.equal(ui.botoes()[1].disabled, false);
  assert.equal(ui.elemento('#users-total').textContent, '1');
  assert.match(ui.elemento('#users-active-share').textContent, /0%/);
  assert.equal(ui.pedidos[0].opcoes.credentials, 'same-origin');
});
test('usuários: administrador não apresenta botão de bloqueio habilitado', async () => {
  const d = usuarios(); d.usuarios[0].papel = 'administrador'; d.usuarios[0].podeAlterarStatus = false;
  const ui = preparar('adm-usuarios.js', async () => resposta(d)); await ui.tick();
  assert.equal(ui.botoes()[1].disabled, true); await ui.botoes()[1].listeners.click(); assert.equal(ui.pedidos.length, 1);
});
test('usuários: cancelamento não envia PATCH; confirmação evita clique duplo e relê estado', async () => {
  let concluir;
  const ui = preparar('adm-usuarios.js', async (url, opcoes) => opcoes.method === 'PATCH' ? new Promise(resolve => { concluir = resolve; }) : resposta(usuarios()));
  await ui.tick(); const botao = ui.botoes()[1];
  ui.confirmar(false); await botao.listeners.click(); assert.equal(ui.pedidos.length, 1);
  ui.confirmar(true); const envio = botao.listeners.click(); await botao.listeners.click();
  assert.equal(ui.pedidos.length, 2); assert.equal(botao.disabled, true);
  const patch = ui.pedidos[1]; assert.equal(patch.opcoes.headers['X-CSRF-Token'], csrf);
  assert.deepEqual(JSON.parse(patch.opcoes.body), { status: 'bloqueado', statusAnterior: 'ativo' });
  concluir(resposta({ ok: true, publicId: id, status: 'bloqueado', mensagem: 'Usuário bloqueado.' }));
  await envio; await ui.tick(); assert.equal(ui.pedidos.length, 3); assert.equal(ui.pedidos[2].opcoes.method, undefined);
  assert.match(ui.elemento('#users-feedback').textContent, /Usuário bloqueado/);
});
test('usuários: resposta perdida não repete mutação; consulta novamente antes de permitir outra', async () => {
  const ui = preparar('adm-usuarios.js', async (url, opcoes) => {
    if (opcoes.method === 'PATCH') throw new Error('Falha de conexão'); return resposta(usuarios());
  }); await ui.tick(); await ui.botoes()[1].listeners.click(); await ui.tick();
  assert.equal(ui.pedidos.filter(p => p.opcoes.method === 'PATCH').length, 1); assert.equal(ui.pedidos.length, 3);
  assert.match(ui.elemento('#users-feedback').textContent, /Confira o status atualizado/);
});
test('usuários: filtros e paginação consultam API; página vazia após mudança volta à última', async () => {
  const respostas = [usuarios({ paginas: 2, total: 21 }), usuarios({ pagina: 2, paginas: 1, total: 20, linhas: [] }), usuarios({ total: 20 }), usuarios({ linhas: [] })];
  const ui = preparar('adm-usuarios.js', async () => resposta(respostas.shift())); await ui.tick();
  await ui.elemento('#users-pagination').children[2].listeners.click(); await ui.tick();
  assert.match(ui.pedidos[1].url, /pagina=2/); assert.match(ui.pedidos[2].url, /pagina=1/);
  ui.elemento('#area-search').value = ' Ana & Bia '; ui.elemento('#area-status').value = 'Bloqueado';
  await ui.elemento('#area-status').listeners.change(); await ui.tick();
  const query = new URLSearchParams(ui.pedidos.at(-1).url.split('?')[1]);
  assert.equal(query.get('busca'), 'Ana & Bia'); assert.equal(query.get('status'), 'bloqueado');
});
test('usuários: erro não deixa números antigos como atuais e oferece nova consulta', async () => {
  let falhar = false;
  const ui = preparar('adm-usuarios.js', async () => falhar ? resposta({ erro: 'Acesso negado' }, 403) : resposta(usuarios()));
  await ui.tick(); falhar = true; await ui.elemento('#area-status').listeners.change(); await ui.tick();
  assert.equal(ui.elemento('#area-table-body').children.length, 0); assert.equal(ui.elemento('#users-total').textContent, '—');
  assert.match(ui.elemento('#users-feedback').textContent, /Acesso negado/);
  falhar = false; await ui.elemento('#users-feedback').children[1].listeners.click(); await ui.tick();
  assert.equal(ui.elemento('#area-table-body').children.length, 1);
});
test('usuários: resposta atrasada de filtro anterior não substitui busca nova', async () => {
  let concluir, chamadas = 0;
  const novo = usuarios(); novo.usuarios[0].nome = 'Busca nova';
  const ui = preparar('adm-usuarios.js', async () => ++chamadas === 1 ? new Promise(resolve => { concluir = resolve; }) : resposta(novo));
  await ui.elemento('#area-status').listeners.change(); await ui.tick();
  concluir(resposta(usuarios())); await ui.tick();
  assert.match(ui.elemento('#area-table-body').textContent, /Busca nova/);
});
test('dashboard: usa dados reais, zeros no gráfico e navega à revisão sem simular aprovação', async () => {
  const ui = preparar('adm-dashboard.js', async () => resposta(dashboard())); await ui.tick();
  assert.match(ui.elemento('#moderation-body').textContent, /<script>alert\(1\)<\/script>/);
  assert.equal(ui.elemento('#daily-chart').children.length, 14);
  assert.ok(ui.elemento('#daily-chart').children.every(li => li.children[0].style.height === '0px'));
  assert.match(ui.elemento('#dashboard-period').textContent, /Total: 0/);
  assert.equal(ui.elemento('#kpi-grid').children.length, 5);
  const tr = ui.elemento('#moderation-body').children[0];
  tr.children.at(-1).children[0].children[1].listeners.click();
  assert.equal(ui.destinos[0], '/adm/moderacao/' + id); assert.equal(ui.pedidos.length, 1);
});
test('dashboard: base vazia é válida e falha não deixa estatísticas fictícias/antigas', async () => {
  const d = dashboard(); d.fila = []; d.atividades = []; d.categorias = [];
  const ui = preparar('adm-dashboard.js', async () => resposta(d)); await ui.tick();
  assert.match(ui.elemento('#moderation-body').textContent, /Nenhum relato aguardando/);
  assert.match(ui.elemento('#category-bars').textContent, /Nenhum relato registrado/);
  const erro = preparar('adm-dashboard.js', async () => resposta({ erro: 'Acesso restrito' }, 403)); await erro.tick();
  assert.equal(erro.elemento('#kpi-grid').children.length, 0); assert.equal(erro.elemento('#daily-chart').children.length, 0);
  assert.match(erro.elemento('#dashboard-feedback').textContent, /Acesso restrito.*Tentar novamente/);
});
