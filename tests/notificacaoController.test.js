const test = require('node:test'), assert = require('node:assert/strict');
const express = require('express'), session = require('express-session'), { once } = require('node:events');
const usuarios = require('../app/models/usuarioModel'), avisos = require('../app/models/notificacaoModel');
const { assinaturaSenha } = require('../app/middlewares/exigirAutenticacao');
test('notificações HTTP: identidade própria, sessão atual, paginação, leitura com CSRF e erros seguros', async t => {
  let papel = 'cidadao', ativo = true, verificado = true, falha, usuarioId = 9;
  const consultas = [], leituras = []; const data = new Date('2026-10-16T18:30:00Z');
  t.mock.method(usuarios, 'buscarPorId', async id => ({ id, nome: 'Teste', papel, status: ativo ? 'ativo' : 'bloqueado',
    email_verificado_em: verificado ? data : null, senha_hash: 'hash' }));
  t.mock.method(avisos, 'listar', async filtro => { if (falha) throw falha; consultas.push(filtro);
    return { notificacoes: [], resumo: { total: 0, naoLidas: 0 }, paginacao: { pagina: filtro.pagina, limite: filtro.limite, total: 0, paginas: 0 } }; });
  t.mock.method(avisos, 'marcarLida', async dados => { leituras.push(dados); if (falha) throw falha;
    if (dados.id === '100' && dados.usuarioId !== 9) throw Object.assign(new Error('Notificação não encontrada.'), { previsto: true, status: 404 });
    return { ok: true, id: dados.id, lidaEm: data }; });
  const app = express(); app.use(express.json());
  app.use(session({ secret: 'notificacoes-somente-teste', resave: false, saveUninitialized: false }));
  app.post('/teste/login', (req, res) => { req.session.usuario = { id: usuarioId };
    req.session.assinaturaSenha = assinaturaSenha({ senha_hash: 'hash' }); res.json({ ok: true }); });
  app.use(require('../app/routes/router'));
  app.use((erro, req, res, next) => res.status(500).json({ erro: 'Erro interno do servidor' }));
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, 'listening'); const origem = 'http://127.0.0.1:' + servidor.address().port; let cookie, token;
  async function pedir(url, { method = 'GET', body, csrf = token, tipo = 'application/json' } = {}) {
    const r = await fetch(origem + url, { method, headers: { ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body !== undefined ? { 'Content-Type': tipo } : {}) },
      ...(body !== undefined ? { body: tipo === 'application/json' ? JSON.stringify(body) : body } : {}) });
    return { status: r.status, texto: await r.text(), cache: r.headers.get('cache-control'), cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const url = '/api/notificacoes', marcar = url + '/lida';
  await t.test('visitante não consulta nem marca leitura', async () => {
    for (const [rota, opcoes] of [[url, {}], [marcar, { method: 'PATCH', body: { id: '100' } }]]) {
      const r = await pedir(rota, opcoes); assert.equal(r.status, 401); assert.equal(r.cache, 'no-store');
    }
    assert.equal(consultas.length, 0); assert.equal(leituras.length, 0);
  });
  cookie = (await pedir('/teste/login', { method: 'POST' })).cookie;
  await t.test('todos os papéis conhecidos recebem apenas consulta própria e token privado', async () => {
    for (papel of ['cidadao', 'moderador', 'administrador']) {
      const r = await pedir(url + '?pagina=2&limite=20&somenteNaoLidas=1'); assert.equal(r.status, 200); assert.equal(r.cache, 'no-store');
      token = JSON.parse(r.texto).csrfToken; assert.match(token, /^[a-f0-9]{64}$/);
      assert.deepEqual(consultas.at(-1), { usuarioId: 9, pagina: 2, limite: 20, somenteNaoLidas: true });
    }
    assert.equal(leituras.length, 0);
  });
  await t.test('paginação/filtros inválidos e identidade no query são recusados antes do model', async () => {
    const antes = consultas.length;
    for (const q of ['pagina=0', 'pagina=01', 'pagina=10001', 'limite=51', 'somenteNaoLidas=true', 'usuarioId=99',
      'pagina=1&pagina=2', 'somenteNaoLidas=1&somenteNaoLidas=0']) assert.equal((await pedir(url + '?' + q)).status, 422, q);
    assert.equal(consultas.length, antes);
  });
  await t.test('marcar leitura exige CSRF/JSON e ID string positivo sem precisão perdida', async () => {
    assert.equal((await pedir(marcar, { method: 'PATCH', body: { id: '100' }, csrf: null })).status, 403);
    assert.equal((await pedir(marcar, { method: 'PATCH', body: { id: '100' }, csrf: 'b'.repeat(64) })).status, 403);
    assert.equal((await pedir(marcar, { method: 'PATCH', body: 'id=100', tipo: 'application/x-www-form-urlencoded' })).status, 415);
    for (const body of [[], {}, { id: 100 }, { id: '0' }, { id: '01' }, { id: '1.5' }, { id: '-1' }, { id: ['100'] },
      { id: '18446744073709551616' }, { id: '100', usuarioId: 99 }]) assert.equal((await pedir(marcar, { method: 'PATCH', body })).status, 422);
    assert.equal(leituras.length, 0);
    for (const id of ['100', '18446744073709551615']) {
      const r = await pedir(marcar, { method: 'PATCH', body: { id } }); assert.equal(r.status, 200);
      assert.deepEqual(leituras.at(-1), { usuarioId: 9, id }); assert.equal(JSON.parse(r.texto).lidaEm, data.toISOString());
    }
  });
  await t.test('uma segunda conta não recebe permissão de leitura por conhecer o ID', async () => {
    const primeiraConta = cookie; usuarioId = 10; cookie = null;
    cookie = (await pedir('/teste/login', { method: 'POST' })).cookie;
    const lista = await pedir(url); token = JSON.parse(lista.texto).csrfToken;
    const r = await pedir(marcar, { method: 'PATCH', body: { id: '100' } }); assert.equal(r.status, 404);
    assert.deepEqual(leituras.at(-1), { usuarioId: 10, id: '100' });
    cookie = primeiraConta; usuarioId = 9; token = JSON.parse((await pedir(url)).texto).csrfToken;
  });
  await t.test('papel desconhecido é negado mesmo com sessão autenticada', async () => {
    papel = 'desconhecido'; const antes = consultas.length;
    assert.equal((await pedir(url)).status, 403); assert.equal(consultas.length, antes); papel = 'cidadao';
  });
  await t.test('erro previsto preservado e falha interna não expõe SQL', async () => {
    falha = Object.assign(new Error('Não encontrada'), { previsto: true, status: 404 });
    assert.equal((await pedir(marcar, { method: 'PATCH', body: { id: '100' } })).status, 404);
    falha = new Error('SELECT senha_hash secreto');
    for (const [rota, opcoes] of [[url, {}], [marcar, { method: 'PATCH', body: { id: '100' } }]]) {
      const r = await pedir(rota, opcoes); assert.equal(r.status, 500); assert.deepEqual(JSON.parse(r.texto), { erro: 'Erro interno do servidor' });
    }
    falha = null;
  });
  await t.test('conta bloqueada ou sem verificação não chega ao model', async () => {
    for (const estado of ['bloqueado', 'pendente']) {
      ativo = estado !== 'bloqueado'; verificado = estado !== 'pendente'; cookie = (await pedir('/teste/login', { method: 'POST' })).cookie;
      const antes = consultas.length; assert.equal((await pedir(url)).status, 401); assert.equal(consultas.length, antes);
    }
  });
});
