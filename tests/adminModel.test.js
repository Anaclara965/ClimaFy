const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAdminModel } = require('../app/models/adminModel');
const { periodosAdmin } = require('../app/helpers/periodosAdmin');
const { criarPoolFalso } = require('./support/fakePool');
const agora = new Date('2026-10-16T18:30:00Z');
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dados = { publicId: id, administradorId: 9, status: 'bloqueado', statusAnterior: 'ativo' };
const alvo = { id: 7, papel: 'cidadao' }, ator = { id: 9 };
const atual = { id: 7, status: 'ativo', email_verificado_em: null };
function preparar(resultados) {
  const pool = criarPoolFalso({ resultados });
  return { pool, model: criarAdminModel(pool, () => agora) };
}
function terminou(pool, sucesso) {
  const sql = pool.chamadas.map(c => c.sql);
  assert.equal(sql.includes('COMMIT'), sucesso); assert.equal(sql.includes('ROLLBACK'), !sucesso);
  assert.equal(sql.at(-1), 'RELEASE');
}

test('períodos usam data civil de São Paulo na virada UTC, mês e semana', () => {
  const p = periodosAdmin(new Date('2026-11-02T01:00:00Z'));
  assert.equal(p.hoje, '2026-11-01');
  assert.equal(p.inicioMes.toISOString(), '2026-11-01T03:00:00.000Z');
  assert.equal(p.inicioSemana.toISOString(), '2026-10-26T03:00:00.000Z');
  assert.equal(p.inicioSemanaAnterior.toISOString(), '2026-10-19T03:00:00.000Z');
  assert.equal(p.dias.length, 14); assert.equal(p.dias[0].data, '2026-10-19');
  assert.equal(p.dias.at(-1).fim.toISOString(), '2026-11-02T01:00:00.000Z');
  p.dias.slice(0, -1).forEach((d, i) => assert.equal(+d.fim, +p.dias[i + 1].inicio));
});
test('segunda-feira e virada de ano não dependem do fuso da máquina', () => {
  const p = periodosAdmin(new Date('2027-01-04T04:00:00Z'));
  assert.equal(p.inicioSemana.toISOString(), '2027-01-04T03:00:00.000Z');
  assert.equal(p.inicioSemanaAnterior.toISOString(), '2026-12-28T03:00:00.000Z');
  assert.equal(p.dias[0].data, '2026-12-22');
});
test('listagem seleciona DTO sem segredo e parametriza busca literal, filtros e paginação', async () => {
  const { pool, model } = preparar([[], [{ public_id: id, id: 7, nome: '<script>', sobrenome: 'Teste', email: 't@example.com',
    papel: 'cidadao', status: 'ativo', created_at: agora, email_verificado_em: null, relatos: '3', senha_hash: 'secreto' }],
  [{ total: '23' }], [{ total: '30', ativos: '20', bloqueados: '3', pendentes: '7', novosMes: '2', novosSemana: '1', novosSemanaAnterior: '0' }]]);
  const r = await model.listarUsuarios({ busca: 'a%_!', status: 'pendente', papel: 'cidadao', pagina: 2, limite: 20 });
  assert.equal(r.usuarios[0].emailVerificado, false); assert.equal(r.usuarios[0].relatos, 3);
  assert.equal(r.usuarios[0].podeAlterarStatus, true); assert.equal('id' in r.usuarios[0], false);
  assert.equal('senha_hash' in r.usuarios[0], false);
  assert.deepEqual(r.paginacao, { pagina: 2, limite: 20, total: 23, paginas: 2 });
  const consulta = pool.chamadas.find(c => c.sql.startsWith('SELECT u.public_id'));
  assert.doesNotMatch(consulta.sql, /senha_hash|a%_!/); assert.match(consulta.sql, /email_verificado_em IS NULL/);
  assert.match(consulta.sql, /deleted_at IS NULL/);
  assert.deepEqual(consulta.parametros, ['%a!%!_!!%', '%a!%!_!!%', '%a!%!_!!%', '%a!%!_!!%', 'a%_!', 'cidadao', 20, 20]);
  assert.match(pool.chamadas[0].sql, /REPEATABLE READ, READ ONLY/); terminou(pool, true);
});
test('dashboard retém 14 dias vazios e só considera moderação da versão atual', async () => {
  const { pool, model } = preparar([[], [{ relatosAtivos: '0', pendentes: '0', aprovadosMes: '0', rejeitadosMes: '0', cidadesComRelatos: '0' }], [],
    [Object.fromEntries(Array.from({ length: 14 }, (_, i) => ['d' + i, '0']))], [], []]);
  const r = await model.dashboard();
  assert.equal(r.dias.length, 14); assert.equal(r.totalPeriodo, 0); assert.ok(r.dias.every(d => d.total === 0));
  assert.deepEqual(r.fila, []); assert.equal(r.fuso, 'America/Sao_Paulo'); assert.equal(r.atualizadoEm, agora.toISOString());
  for (const c of pool.chamadas.filter(c => c.sql.includes('LEFT JOIN moderacoes_relato'))) assert.match(c.sql, /mm.versao_conteudo = r.versao_conteudo/);
  assert.equal(pool.chamadas.some(c => /INSERT|UPDATE usuarios|DELETE FROM/.test(c.sql)), false); terminou(pool, true);
});
test('bloqueio e auditoria fazem parte da mesma transação, sem modificar papel/verificação/senha', async () => {
  const { pool, model } = preparar([[alvo], [ator], [atual], { affectedRows: 1 }, { affectedRows: 1 }]);
  const r = await model.alterarStatus(dados);
  assert.equal(r.status, 'bloqueado'); assert.equal(r.emailVerificado, false);
  const update = pool.chamadas.find(c => c.sql.startsWith('UPDATE'));
  assert.deepEqual(update.parametros, ['bloqueado', 7, 'ativo']); assert.match(update.sql, /SET status = \? WHERE/);
  const log = pool.chamadas.find(c => c.sql.startsWith('INSERT'));
  assert.deepEqual(log.parametros, [9, 7, '{"status":"ativo"}', '{"status":"bloqueado"}']); terminou(pool, true);
  const consultaAtor = pool.chamadas.find(c => c.sql.includes('SELECT u.id FROM usuarios'));
  assert.match(consultaAtor.sql, /p.codigo IN \('moderador', 'administrador'\)/);
  assert.match(consultaAtor.sql, /email_verificado_em IS NOT NULL/);
});
test('desbloqueio não verifica e-mail e operação repetida não duplica auditoria', async () => {
  for (const statusAtual of ['ativo', 'bloqueado']) {
    const { pool, model } = preparar([[alvo], [ator], [{ ...atual, status: statusAtual }], { affectedRows: 1 }, {}]);
    const r = await model.alterarStatus({ ...dados, status: 'ativo', statusAnterior: 'bloqueado' });
    assert.equal(r.emailVerificado, false); assert.match(r.mensagem, /verificação de e-mail continua obrigatória/);
    assert.equal(pool.chamadas.filter(c => c.sql.startsWith('INSERT')).length, statusAtual === 'ativo' ? 0 : 1); terminou(pool, true);
  }
});
test('administrador e própria conta são protegidos antes de qualquer UPDATE', async () => {
  for (const protegido of [{ id: 7, papel: 'administrador' }, { id: 9, papel: 'cidadao' }, { id: 9, papel: 'moderador' }]) {
    const { pool, model } = preparar([[protegido]]);
    await assert.rejects(model.alterarStatus(dados), { status: 403 });
    assert.equal(pool.chamadas.some(c => c.sql.startsWith('UPDATE')), false); terminou(pool, false);
  }
});
test('alvo ausente, ator sem permissão, conta inativa e status antigo são recusados', async () => {
  for (const [respostas, status, entrada] of [
    [[[]], 404, dados], [[[alvo], []], 403, dados], [[[alvo], [ator], []], 404, dados],
    [[[alvo], [ator], [{ ...atual, status: 'inativo' }]], 409, dados],
    [[[alvo], [ator], [atual]], 409, { ...dados, statusAnterior: 'bloqueado' }],
    [[[alvo], [ator], [atual], { affectedRows: 0 }], 409, dados],
  ]) {
    const { pool, model } = preparar(respostas);
    await assert.rejects(model.alterarStatus(entrada), { status }); terminou(pool, false);
  }
});
test('model também recusa transição inválida, sem abrir transação', async () => {
  const { pool, model } = preparar([]);
  await assert.rejects(model.alterarStatus({ ...dados, status: 'administrador' }), { status: 422 });
  assert.equal(pool.chamadas.length, 0);
});
test('falha na auditoria reverte bloqueio e libera conexão', async () => {
  const { pool, model } = preparar([[alvo], [ator], [atual], { affectedRows: 1 }]);
  const obter = pool.getConnection;
  pool.getConnection = async () => {
    const c = await obter(), consultar = c.query;
    c.query = async (sql, valores) => { if (sql.startsWith('INSERT')) throw new Error('auditoria indisponível'); return consultar(sql, valores); };
    return c;
  };
  await assert.rejects(model.alterarStatus(dados), /auditoria indisponível/); terminou(pool, false);
});
