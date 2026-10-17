const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), { once } = require('node:events');
const express = require('express'), session = require('express-session');
const usuarios = require('../app/models/usuarioModel'), admin = require('../app/models/adminModel');
const { assinaturaSenha } = require('../app/middlewares/exigirAutenticacao');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('admin HTTP: sessão atual, autorização, CSRF, validação, telas existentes e erros seguros', async t => {
  let papel = 'administrador', ativo = true, verificado = true, falha;
  const consultas = [], alteracoes = []; let dashboards = 0;
  t.mock.method(usuarios, 'buscarPorId', async () => ({ id: 9, nome: '<Admin>', sobrenome: 'Teste', email: 'admin@example.com',
    papel, status: ativo ? 'ativo' : 'bloqueado', email_verificado_em: verificado ? new Date() : null, senha_hash: 'hash' }));
  t.mock.method(admin, 'listarUsuarios', async filtro => { consultas.push(filtro); if (falha) throw falha;
    return { usuarios: [], resumo: {}, paginacao: { pagina: 1, limite: 20, total: 0, paginas: 0 } }; });
  t.mock.method(admin, 'alterarStatus', async dados => { alteracoes.push(dados); if (falha) throw falha; return { ok: true, ...dados }; });
  t.mock.method(admin, 'dashboard', async () => { dashboards++; if (falha) throw falha; return { resumo: { pendentes: 0 } }; });
  const app = express(); app.use(express.json());
  app.use(session({ secret: 'admin-somente-testes', resave: false, saveUninitialized: false }));
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '../app/views'));
  app.post('/teste/login', (req, res) => { req.session.usuario = { id: 9 };
    req.session.assinaturaSenha = assinaturaSenha({ senha_hash: 'hash' }); res.json({ ok: true }); });
  app.use(require('../app/routes/router-adm'));
  app.use((erro, req, res, next) => res.status(500).json({ erro: 'Erro interno do servidor' }));
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, 'listening'); const origem = 'http://127.0.0.1:' + servidor.address().port;
  let cookie, token;
  async function pedir(url, { method = 'GET', body, sessao = true, csrf = token, tipo = 'application/json' } = {}) {
    const r = await fetch(origem + url, { method, redirect: 'manual', headers: {
      ...(sessao && cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(body !== undefined ? { 'Content-Type': tipo } : {}),
    }, ...(body !== undefined ? { body: tipo === 'application/json' ? JSON.stringify(body) : body } : {}) });
    return { status: r.status, texto: await r.text(), cache: r.headers.get('cache-control'), cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const url = '/api/adm/usuarios/' + id + '/status', dados = { status: 'bloqueado', statusAnterior: 'ativo' };
  await t.test('visitante não consulta nem modifica usuários/dashboard', async () => {
    for (const rota of ['/api/adm/usuarios', '/api/adm/dashboard']) {
      const r = await pedir(rota); assert.equal(r.status, 401); assert.equal(r.cache, 'no-store');
    }
    assert.equal((await pedir(url, { method: 'PATCH', body: dados })).status, 401);
    assert.equal((await pedir('/adm')).status, 303); assert.equal(consultas.length, 0);
  });
  cookie = (await pedir('/teste/login', { method: 'POST' })).cookie;
  await t.test('cidadão e papel desconhecido são recusados inclusive com sessão anteriormente de admin', async () => {
    for (papel of ['cidadao', 'desconhecido']) {
      for (const rota of ['/api/adm/usuarios', '/api/adm/dashboard', '/adm', '/adm/usuarios', '/adm/relatos', '/adm/moderacao', '/adm/investimentos', '/adm/relatorios']) assert.equal((await pedir(rota)).status, 403);
      assert.equal((await pedir(url, { method: 'PATCH', body: dados })).status, 403);
    }
    assert.equal(consultas.length, 0); assert.equal(dashboards, 0); papel = 'administrador';
  });
  await t.test('admin recebe consulta normalizada e token privado', async () => {
    const r = await pedir('/api/adm/usuarios?busca=%20Ana%20&status=pendente&papel=cidadao&pagina=2&limite=10');
    assert.equal(r.status, 200); assert.equal(r.cache, 'no-store'); token = JSON.parse(r.texto).csrfToken;
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.deepEqual(consultas.at(-1), { busca: 'Ana', status: 'pendente', papel: 'cidadao', pagina: 2, limite: 10 });
    assert.equal((await pedir('/api/adm/dashboard')).status, 200);
  });
  await t.test('EJS existente escapa identidade real; não usa lista demonstrativa', async () => {
    for (const [rota, script] of [['/adm', 'adm-dashboard.js'], ['/adm/usuarios', 'adm-usuarios.js']]) {
      const r = await pedir(rota); assert.equal(r.status, 200); assert.equal(r.cache, 'no-store');
      assert.match(r.texto, /&lt;Admin&gt;/); assert.match(r.texto, /admin@example.com/);
      assert.match(r.texto, new RegExp(script)); assert.doesNotMatch(r.texto, /adm-areas.js|Dados demonstrativos/);
    }
  });
  await t.test('filtros repetidos/estruturados e paginação inválida não chegam ao model', async () => {
    const antes = consultas.length;
    for (const q of ['pagina=0', 'pagina=01', 'pagina=10001', 'limite=51', 'limite=1.5', 'status=aprovado', 'papel=superadmin',
      'busca=a&busca=b', 'status=ativo&status=bloqueado', 'busca=' + 'a'.repeat(101)]) {
      assert.equal((await pedir('/api/adm/usuarios?' + q)).status, 422, q);
    }
    assert.equal(consultas.length, antes);
  });
  await t.test('alteração exige JSON, token, UUID e dois status conhecidos', async () => {
    assert.equal((await pedir(url, { method: 'PATCH', body: dados, csrf: null })).status, 403);
    assert.equal((await pedir(url, { method: 'PATCH', body: dados, csrf: 'b'.repeat(64) })).status, 403);
    assert.equal((await pedir(url, { method: 'PATCH', body: '', tipo: 'application/x-www-form-urlencoded' })).status, 415);
    assert.equal((await pedir('/api/adm/usuarios/invalido/status', { method: 'PATCH', body: dados })).status, 404);
    for (const body of [[], {}, { ...dados, statusAnterior: undefined }, { ...dados, status: 'inativo' }, { ...dados, status: ['ativo'] }]) {
      assert.equal((await pedir(url, { method: 'PATCH', body })).status, 422);
    }
    assert.equal(alteracoes.length, 0);
  });
  await t.test('identidade e permissão vêm da sessão, não do corpo', async () => {
    const r = await pedir(url, { method: 'PATCH', body: { ...dados, administradorId: 999, papel: 'administrador', emailVerificado: true } });
    assert.equal(r.status, 200);
    assert.deepEqual(alteracoes.at(-1), { publicId: id, administradorId: 9, ...dados });
  });
  await t.test('moderador abre todas as áreas do painel e usa as APIs com CSRF', async () => {
    papel = 'moderador';
    for (const rota of ['/adm', '/adm/usuarios', '/adm/moderacao', '/adm/investimentos', '/adm/relatorios', '/api/adm/usuarios', '/api/adm/dashboard']) {
      assert.equal((await pedir(rota)).status, 200, rota);
    }
    assert.equal((await pedir('/adm/relatos')).status, 303);
    assert.equal((await pedir(url, { method: 'PATCH', body: dados, csrf: null })).status, 403);
    for (const status of ['bloqueado', 'ativo']) {
      assert.equal((await pedir(url, { method: 'PATCH', body: { ...dados, status } })).status, 200);
      assert.equal(alteracoes.at(-1).administradorId, 9);
    }
    papel = 'administrador';
  });
  await t.test('erros previstos preservados; falha interna não expõe SQL', async () => {
    for (const status of [403, 404, 409]) {
      falha = Object.assign(new Error('Ação recusada'), { status, previsto: true });
      assert.equal((await pedir(url, { method: 'PATCH', body: dados })).status, status);
    }
    falha = new Error('senha_hash SQL secreto');
    for (const rota of ['/api/adm/usuarios', '/api/adm/dashboard']) {
      const r = await pedir(rota); assert.equal(r.status, 500); assert.deepEqual(JSON.parse(r.texto), { erro: 'Erro interno do servidor' });
    }
    falha = null;
  });
  await t.test('bloqueio ou e-mail não verificado invalida acesso antes dos models', async () => {
    for (const estado of ['bloqueado', 'pendente']) {
      ativo = estado !== 'bloqueado'; verificado = estado !== 'pendente';
      cookie = (await pedir('/teste/login', { method: 'POST' })).cookie; const antes = consultas.length;
      assert.equal((await pedir('/api/adm/usuarios')).status, 401); assert.equal(consultas.length, antes);
    }
  });
});
