const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), { once } = require('node:events');
const express = require('express'), session = require('express-session');
const usuarios = require('../app/models/usuarioModel'), relatorios = require('../app/models/relatorioModel');
const { assinaturaSenha } = require('../app/middlewares/exigirAutenticacao');
test('exportação HTTP privada: filtros, CSV, permissões atuais e erros antes de iniciar download', async t => {
  let papel = 'moderador', ativo = true, verificado = true, falha, linhas = [];
  const consultas = []; let leiturasFiltros = 0;
  t.mock.method(usuarios, 'buscarPorId', async () => ({ id: 9, nome: '<Mod>', email: 'mod@example.com', papel,
    status: ativo ? 'ativo' : 'bloqueado', email_verificado_em: verificado ? new Date() : null, senha_hash: 'hash' }));
  t.mock.method(relatorios, 'filtros', async () => { leiturasFiltros++; if (falha) throw falha; return { categorias: [], bairros: [], limite: 5000 }; });
  t.mock.method(relatorios, 'exportar', async filtros => { consultas.push(filtros); if (falha) throw falha;
    return { geradoEm: '2026-10-16T18:30:00.000Z', relatos: linhas }; });
  const app = express(); app.use(session({ secret: 'relatorios-apenas-teste', resave: false, saveUninitialized: false }));
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '../app/views'));
  app.post('/teste/login', (req, res) => { req.session.usuario = { id: 9 };
    req.session.assinaturaSenha = assinaturaSenha({ senha_hash: 'hash' }); res.json({ ok: true }); });
  app.use(require('../app/routes/router-adm'));
  app.use((erro, req, res, next) => res.status(500).json({ erro: 'Erro interno do servidor' }));
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, 'listening'); const origem = 'http://127.0.0.1:' + servidor.address().port; let cookie;
  async function pedir(url, method = 'GET') {
    const r = await fetch(origem + url, { method, redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
    return { status: r.status, texto: await r.text(), headers: r.headers, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const csv = '/api/adm/relatorios/relatos.csv', filtros = '/api/adm/relatorios/filtros';
  await t.test('visitante não exporta nem carrega metadados', async () => {
    for (const rota of [csv, filtros]) { const r = await pedir(rota); assert.equal(r.status, 401); assert.equal(r.headers.get('cache-control'), 'no-store'); }
    assert.equal((await pedir('/adm/relatorios')).status, 303); assert.equal(consultas.length, 0); assert.equal(leiturasFiltros, 0);
  });
  cookie = (await pedir('/teste/login', 'POST')).cookie;
  await t.test('cidadão/papel desconhecido recebem 403 antes de qualquer consulta', async () => {
    for (papel of ['cidadao', 'desconhecido']) for (const rota of [csv, filtros, '/adm/relatorios']) assert.equal((await pedir(rota)).status, 403);
    assert.equal(consultas.length, 0); assert.equal(leiturasFiltros, 0); papel = 'moderador';
  });
  await t.test('moderador e administrador recebem arquivo vazio válido, sem CSRF em GET somente leitura', async () => {
    for (papel of ['moderador', 'administrador']) {
      const r = await pedir(csv); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/csv; charset=utf-8/);
      assert.match(r.headers.get('content-disposition'), /attachment; filename="climafy-relatos-20261016-183000.csv"/);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(r.headers.get('x-relatos-total'), '0');
      assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.texto, /Identificador do relato/);
      assert.equal(r.texto.split('\r\n').length, 2); assert.equal((await pedir(filtros)).status, 200);
    }
  });
  await t.test('tela existente usa filtros, identidade escapada e não anuncia relatórios fictícios', async () => {
    const r = await pedir('/adm/relatorios'); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(r.texto, /&lt;Mod&gt;/); assert.match(r.texto, /id="report-export-form"/); assert.match(r.texto, /adm-relatorios.js/);
    assert.doesNotMatch(r.texto, /data-message=|adm-areas.js|29\/07\/2026|admin@climafy.br/);
    assert.equal((r.texto.match(/Ainda não implementado/g) || []).length, 5);
  });
  await t.test('filtros válidos são normalizados; duplicados, desconhecidos e inválidos não chegam ao model', async () => {
    await pedir(csv + '?dias=todos&categoria=alagamento&bairro=85&status=resolvido');
    assert.deepEqual(consultas.at(-1), { dias: null, categoria: 'alagamento', bairro: 85, status: 'resolvido' });
    const antes = consultas.length;
    for (const q of ['dias=1', 'dias=7&dias=30', 'bairro=0', 'status=aprovado', 'categoria=x%27', 'limite=99999', 'usuarioId=1']) {
      const r = await pedir(csv + '?' + q); assert.equal(r.status, 422); assert.match(r.headers.get('content-type'), /application\/json/);
      assert.equal(r.headers.get('content-disposition'), null);
    }
    assert.equal(consultas.length, antes);
  });
  await t.test('erro de volume e falha de banco não iniciam arquivo parcial nem expõem SQL', async () => {
    falha = Object.assign(new Error('Reduza o período.'), { previsto: true, status: 422 });
    const volume = await pedir(csv); assert.equal(volume.status, 422); assert.equal(volume.headers.get('content-disposition'), null);
    falha = new Error('SELECT senha_hash secreto');
    for (const rota of [csv, filtros]) { const r = await pedir(rota); assert.equal(r.status, 500); assert.deepEqual(JSON.parse(r.texto), { erro: 'Erro interno do servidor' }); }
    falha = null;
  });
  await t.test('conta bloqueada ou sem verificação perde acesso antes de exportar', async () => {
    for (const estado of ['bloqueado', 'pendente']) {
      ativo = estado !== 'bloqueado'; verificado = estado !== 'pendente';
      cookie = (await pedir('/teste/login', 'POST')).cookie; const antes = consultas.length;
      assert.equal((await pedir(csv)).status, 401); assert.equal(consultas.length, antes);
    }
  });
});
