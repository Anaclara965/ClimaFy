const test = require('node:test'), assert = require('node:assert/strict');
const express = require('express'), session = require('express-session'), { once } = require('node:events');
const usuarios = require('../app/models/usuarioModel'), investimentos = require('../app/models/investimentoModel');
const { assinaturaSenha } = require('../app/middlewares/exigirAutenticacao');
test('orçamento HTTP privado: permissões atuais, filtros e erros seguros', async t => {
  let papel = 'moderador', ativo = true, verificado = true, falha; const chamadas = [];
  t.mock.method(usuarios, 'buscarPorId', async () => ({ id: 9, nome: 'Teste', email: 'teste@example.com', papel,
    status: ativo ? 'ativo' : 'bloqueado', email_verificado_em: verificado ? new Date() : null, senha_hash: 'hash' }));
  t.mock.method(investimentos, 'consultar', async filtros => { if (falha) throw falha; chamadas.push(filtros); return { orcamentos: [], paginacao: { total: 0 } }; });
  const app = express(); app.use(session({ secret: 'orcamento-somente-testes', resave: false, saveUninitialized: false }));
  app.post('/teste/login', (req, res) => { req.session.usuario = { id: 9 };
    req.session.assinaturaSenha = assinaturaSenha({ senha_hash: 'hash' }); res.json({ ok: true }); });
  app.use(require('../app/routes/router-adm'));
  app.use((erro, req, res, next) => res.status(500).json({ erro: 'Erro interno do servidor' }));
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, 'listening'); const origem = 'http://127.0.0.1:' + servidor.address().port; let cookie;
  async function pedir(q = '', method = 'GET', rota = '/api/adm/investimentos') {
    const r = await fetch(origem + rota + q, { method, headers: cookie ? { Cookie: cookie } : {} });
    return { status: r.status, cache: r.headers.get('cache-control'), texto: await r.text(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  await t.test('visitante recebe 401 sem consultar orçamento', async () => { const r = await pedir(); assert.equal(r.status, 401); assert.equal(r.cache, 'no-store'); assert.equal(chamadas.length, 0); });
  cookie = (await pedir('', 'POST', '/teste/login')).cookie;
  await t.test('cidadão/papel desconhecido são negados mesmo com sessão anteriormente de equipe', async () => {
    for (papel of ['cidadao', 'desconhecido']) assert.equal((await pedir()).status, 403);
    assert.equal(chamadas.length, 0); papel = 'moderador';
  });
  await t.test('moderador e administrador consultam sem CSRF em GET somente leitura', async () => {
    for (papel of ['moderador', 'administrador']) { const r = await pedir(); assert.equal(r.status, 200); assert.equal(r.cache, 'no-store'); }
    assert.deepEqual(chamadas.at(-1), { ano: 2026, busca: '', subprefeitura: undefined, ordem: 'nome', pagina: 1, limite: 20 });
  });
  await t.test('filtros válidos são normalizados e paginação é limitada', async () => {
    const r = await pedir('?ano=2026&busca=%20S%C3%A9%20&subprefeitura=pinheiros&ordem=realizado-menor&pagina=2&limite=10'); assert.equal(r.status, 200);
    assert.deepEqual(chamadas.at(-1), { ano: 2026, busca: 'Sé', subprefeitura: 'pinheiros', ordem: 'realizado-menor', pagina: 2, limite: 10 });
  });
  await t.test('API não oferece criação, edição ou exclusão de orçamento', async () => {
    const antes = chamadas.length;
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await pedir('', method)).status, 404);
    assert.equal(chamadas.length, antes);
  });
  await t.test('ano indisponível, campos de projeto e filtros inválidos não chegam ao model', async () => {
    const antes = chamadas.length;
    for (const q of ['ano=2025', 'ano=', 'status=concluido', 'usuarioId=99', 'pagina=0', 'pagina=01', 'pagina=10001', 'limite=51',
      'ordem=progresso', 'ordem=', 'subprefeitura=x%27', 'subprefeitura=' + 'a'.repeat(101), 'busca=' + 'a'.repeat(101), 'busca=a&busca=b', 'ano=2026&ano=2026']) {
      assert.equal((await pedir('?' + q)).status, 422, q);
    }
    assert.equal(chamadas.length, antes);
  });
  await t.test('indisponibilidade publicada é explícita e SQL interno não é exposto', async () => {
    falha = Object.assign(new Error('Sem orçamento publicado.'), { previsto: true, status: 503, codigo: 'ORCAMENTO_INDISPONIVEL' });
    const r = await pedir(); assert.equal(r.status, 503); assert.equal(JSON.parse(r.texto).codigo, 'ORCAMENTO_INDISPONIVEL');
    falha = new Error('SELECT segredo SQL'); const erro = await pedir(); assert.equal(erro.status, 500); assert.deepEqual(JSON.parse(erro.texto), { erro: 'Erro interno do servidor' }); falha = null;
  });
  await t.test('bloqueio ou falta de verificação revoga acesso antes da consulta', async () => {
    for (const estado of ['bloqueado', 'pendente']) {
      ativo = estado !== 'bloqueado'; verificado = estado !== 'pendente'; cookie = (await pedir('', 'POST', '/teste/login')).cookie;
      const antes = chamadas.length; assert.equal((await pedir()).status, 401); assert.equal(chamadas.length, antes);
    }
  });
});
