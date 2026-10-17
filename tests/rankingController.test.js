const test = require('node:test'), assert = require('node:assert/strict');
const express = require('express'), { once } = require('node:events');
const model = require('../app/models/rankingModel');
test('API de ranking é pública, validada e não expõe falhas internas', async t => {
  const chamadas = []; let falha;
  t.mock.method(model, 'consultar', async filtro => { if (falha) throw falha; chamadas.push(filtro); return { ranking: [], resumo: { areasMonitoradas: 0 } }; });
  const app = express(); app.use(require('../app/routes/router'));
  app.use((erro, req, res, next) => res.status(500).json({ erro: 'Erro interno do servidor' }));
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, 'listening'); const origem = 'http://127.0.0.1:' + servidor.address().port;
  async function pedir(q = '') { const r = await fetch(origem + '/api/ranking' + q); return { status: r.status, cache: r.headers.get('cache-control'), dados: await r.json() }; }
  await t.test('visitante sem cookie recebe JSON sem criar sessão', async () => {
    const r = await pedir(); assert.equal(r.status, 200); assert.equal(r.cache, 'no-store');
    assert.deepEqual(chamadas.at(-1), { periodo: 'ano', busca: '', ordem: 'prioridade' });
  });
  await t.test('filtros de período, busca e ordem chegam normalizados', async () => {
    for (const periodo of ['ano', '7d', '30d', '90d']) assert.equal((await pedir('?periodo=' + periodo)).status, 200);
    await pedir('?periodo=30d&busca=%20S%C3%A9%20&ordem=orcamento');
    assert.deepEqual(chamadas.at(-1), { periodo: '30d', busca: 'Sé', ordem: 'orcamento' });
  });
  await t.test('filtros inválidos/repetidos ou tentativa de alterar pesos são recusados', async () => {
    const antes = chamadas.length;
    for (const q of ['?periodo=365d', '?periodo=7d&periodo=30d', '?ordem=x', '?busca=a&busca=b', '?peso=0.9', '?ano=2025', '?busca=' + 'a'.repeat(101)]) assert.equal((await pedir(q)).status, 422);
    assert.equal(chamadas.length, antes);
  });
  await t.test('ausência de publicação tem 503 explícito; SQL interno nunca é exposto', async () => {
    falha = Object.assign(new Error('Ainda sem publicação.'), { previsto: true, status: 503, codigo: 'RANKING_INDISPONIVEL' });
    const r = await pedir(); assert.equal(r.status, 503); assert.equal(r.dados.codigo, 'RANKING_INDISPONIVEL');
    falha = new Error('SELECT senha_hash secreto'); const erro = await pedir(); assert.equal(erro.status, 500); assert.deepEqual(erro.dados, { erro: 'Erro interno do servidor' });
  });
});
