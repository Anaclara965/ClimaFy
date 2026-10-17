const test = require('node:test'), assert = require('node:assert/strict');
const { csvRelatos, celula } = require('../app/helpers/csvRelatos');
const { validarFiltros } = require('../app/controllers/relatorioControllers');
const { criarRelatorioModel, LIMITE_EXPORTACAO } = require('../app/models/relatorioModel');
const { criarPoolFalso } = require('./support/fakePool');
const agora = new Date('2026-10-16T18:30:00Z');
const linha = { public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', created_at: new Date('2026-10-02T18:36:05Z'),
  cidade: 'São Paulo', bairro: 'Consolação', categoria: 'Alagamento', gravidade: 'grave', status: 'aberto',
  versao_conteudo: 2, decisao: null, votos: '3', email: 'NAO_EXPORTAR', titulo: 'NAO_EXPORTAR', latitude: '-23.55', usuario_id: 9 };

test('CSV vazio tem BOM, cabeçalho pt-BR e CRLF; não inventa linhas', () => {
  const csv = csvRelatos([]); assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Identificador do relato";"Criado em \(UTC\)"/);
  assert.equal(csv.split('\r\n').length, 2); assert.ok(csv.endsWith('\r\n'));
});
test('CSV escapa aspas, separador e quebras dentro da célula', () => {
  assert.equal(celula('Consolação; "Brás"\r\nCentro'), '"Consolação; ""Brás""\r\nCentro"');
  assert.equal(celula(null), '""'); assert.equal(celula(0), '"0"');
  assert.equal(celula('a\u0000b'), '"ab"');
});
test('CSV reduz interpretação de fórmulas inclusive após espaços/controles e variantes Unicode', () => {
  for (const valor of ['=1+2', '+CMD()', '-1+2', '@SUM(A1)', '  =2', '\t=1', '\r=1', '\n=1', '\ufeff=1', '\u0001+1', '＝1', '＋1', '－1', '＠a', '=1";=2']) {
    assert.ok(celula(valor).startsWith('"\''), JSON.stringify(valor));
  }
  assert.equal(celula('Bairro = Centro'), '"Bairro = Centro"');
});
test('CSV usa somente colunas explícitas e exclui campos extras pessoais e textos livres', () => {
  const csv = csvRelatos([{ publicId: 'uuid', criadoEm: agora.toISOString(), cidade: 'São Paulo', bairro: 'Brás',
    categoria: 'Lixo', severidade: 'leve', status: 'aberto', moderacao: 'pendente', versao: '2', votos: 0,
    email: 'NAO_EXPORTAR', nome: 'NAO_EXPORTAR', titulo: 'NAO_EXPORTAR', descricao: 'NAO_EXPORTAR', latitude: 'NAO_EXPORTAR' }]);
  assert.doesNotMatch(csv, /NAO_EXPORTAR/); assert.equal(csv.split('\r\n')[1].split(';').length, 10);
  assert.match(csv, /"Brás"/); assert.match(csv, /"pendente";"2";"0"/);
});
test('filtros padrão e todo o histórico têm contrato explícito', () => {
  assert.deepEqual(validarFiltros({}), { dias: 30, categoria: undefined, bairro: undefined, status: undefined });
  assert.deepEqual(validarFiltros({ dias: 'todos', categoria: '', bairro: '', status: '' }),
    { dias: null, categoria: undefined, bairro: undefined, status: undefined });
  for (const dias of ['7', '30', '90', '365']) assert.equal(validarFiltros({ dias }).dias, Number(dias));
  assert.deepEqual(validarFiltros({ dias: '7', categoria: 'poluicao-agua', bairro: '85', status: 'em_andamento' }),
    { dias: 7, categoria: 'poluicao-agua', bairro: 85, status: 'em_andamento' });
});
test('filtros recusam arrays/objetos, chaves inesperadas, números e enums fora do contrato', () => {
  for (const query of [{ dias: '0' }, { dias: '31' }, { dias: '30 ' }, { dias: ['30'] }, { dias: 30 }, { status: 'aprovado' },
    { categoria: 'a'.repeat(81) }, { categoria: "x' OR 1=1" }, { bairro: '01' }, { bairro: '-1' }, { bairro: '4294967296' },
    { bairro: {} }, { autorId: '1' }, { limite: '99999' }, { categoria: 'x/y' }, { bairro: '1.5' }]) {
    assert.throws(() => validarFiltros(query), { status: 422, previsto: true }, JSON.stringify(query));
  }
});
test('model exporta uma consulta parametrizada, consistente e limitada, sem dados de usuários', async () => {
  const pool = criarPoolFalso({ resultados: [[linha]] }), model = criarRelatorioModel(pool, () => agora);
  const r = await model.exportar({ dias: 30, categoria: 'alagamento', bairro: 85, status: 'aberto' });
  assert.equal(pool.chamadas.length, 1); const c = pool.chamadas[0];
  assert.deepEqual(c.parametros, [agora, new Date('2026-09-16T18:30:00Z'), 'alagamento', 85, 'aberto', 5001]);
  assert.match(c.sql, /r.deleted_at IS NULL/); assert.match(c.sql, /mm.versao_conteudo = r.versao_conteudo/);
  assert.match(c.sql, /ORDER BY r.created_at DESC, r.id DESC LIMIT \?/);
  assert.doesNotMatch(c.sql, /JOIN usuarios|senha_hash|email|r\.titulo|r\.descricao|r\.latitude|r\.longitude|r\.usuario_id/);
  assert.equal(r.relatos[0].moderacao, 'pendente'); assert.equal(r.relatos[0].versao, '2'); assert.equal(r.relatos[0].votos, 3);
  assert.equal(r.geradoEm, agora.toISOString()); assert.equal(Object.keys(r.relatos[0]).length, 10);
  assert.doesNotMatch(JSON.stringify(r), /NAO_EXPORTAR|-23\.55/);
});
test('todo o histórico não aplica data inicial e filtros não interpolam SQL', async () => {
  const pool = criarPoolFalso({ resultados: [[]] }), model = criarRelatorioModel(pool, () => agora);
  await model.exportar({ dias: null, categoria: "x' OR 1=1" });
  assert.doesNotMatch(pool.chamadas[0].sql, /created_at >=|x' OR/);
  assert.deepEqual(pool.chamadas[0].parametros, [agora, "x' OR 1=1", 5001]);
});
test('limite é inclusivo: 5 mil funciona, 5.001 recusa sem truncar', async () => {
  const pool = criarPoolFalso({ resultados: [Array(LIMITE_EXPORTACAO).fill(linha), Array(LIMITE_EXPORTACAO + 1).fill(linha)] });
  const model = criarRelatorioModel(pool, () => agora);
  assert.equal((await model.exportar()).relatos.length, 5000);
  await assert.rejects(model.exportar(), { status: 422, previsto: true });
});
test('filtros vêm dos relatos não excluídos, preservam geografia histórica e omitem extras', async () => {
  const pool = criarPoolFalso({ resultados: [[{ slug: 'alagamento', nome: 'Alagamento', email: 'NAO_EXPORTAR' }],
    [{ id: '85', nome: 'Consolação', cidade: 'São Paulo', email: 'NAO_EXPORTAR' }]] });
  const r = await criarRelatorioModel(pool).filtros();
  assert.deepEqual(r, { categorias: [{ slug: 'alagamento', nome: 'Alagamento' }], bairros: [{ id: 85, nome: 'Consolação', cidade: 'São Paulo' }], limite: 5000 });
  pool.chamadas.forEach(c => { assert.match(c.sql, /deleted_at IS NULL/); assert.doesNotMatch(c.sql, /ativo = 1|usuarios/); });
});
