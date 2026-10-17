const test = require('node:test'), assert = require('node:assert/strict');
const { criarNotificacaoModel, registrarAtualizacao } = require('../app/models/notificacaoModel');
const { criarModeracaoModel } = require('../app/models/moderacaoModel');
const { criarPoolFalso } = require('./support/fakePool');
const data = new Date('2026-10-16T18:30:00Z');
const id = '18446744073709551615';
const relato = { id: 10, usuario_id: 8, titulo: 'Rua <img src=x> alagada', status: 'aberto', versao_conteudo: 2 };
const pedido = { publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', moderadorId: 9, versao: '2', revisao: '0', decisao: 'aprovado' };
for (const [decisao, tipo] of [['aprovado', 'relato_aprovado'], ['rejeitado', 'relato_rejeitado'], ['solicitado_ajuste', 'relato_ajuste']]) {
  test(`aviso ${decisao} usa autor real e mesma transação da moderação`, async () => {
    const respostas = [[{ id: 9 }], [relato], []]; if (decisao !== 'aprovado') respostas.push([{ id: 4 }]);
    respostas.push({ affectedRows: 1 }, { affectedRows: 1 });
    const pool = criarPoolFalso({ resultados: respostas });
    await criarModeracaoModel(pool).alterar({ ...pedido, decisao, motivo: 'duplicado' });
    const aviso = pool.chamadas.find(c => c.sql.startsWith('INSERT INTO notificacoes'));
    assert.equal(aviso.parametros[0], tipo); assert.equal(aviso.parametros[3], 8);
    assert.match(aviso.parametros[2], /versão 2/); assert.match(aviso.parametros[2], /Rua <img src=x> alagada/);
    assert.ok(pool.chamadas.every(c => c.rotulo === 'conexao'));
    assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['COMMIT', 'RELEASE']);
    assert.ok(pool.chamadas.findIndex(c => c.sql.startsWith('INSERT INTO moderacoes')) < pool.chamadas.indexOf(aviso));
  });
}
for (const [situacao, rotulo] of [['em_andamento', 'Em andamento'], ['resolvido', 'Resolvido'], ['aberto', 'Aberto']]) {
  test(`mudança para ${situacao} salva histórico e aviso sem mudar aprovação`, async () => {
    const atual = situacao === 'aberto' ? 'resolvido' : 'aberto';
    const pool = criarPoolFalso({ resultados: [[{ id: 9 }], [{ ...relato, status: atual }], {}, {}, {}] });
    await criarModeracaoModel(pool).alterar({ ...pedido, situacao, statusAnterior: atual });
    const aviso = pool.chamadas.find(c => c.sql.startsWith('INSERT INTO notificacoes'));
    assert.equal(aviso.parametros[0], 'relato_situacao'); assert.equal(aviso.parametros[3], 8);
    assert.ok(aviso.parametros[2].includes(rotulo)); assert.match(aviso.parametros[2], /versão 2/);
    assert.equal(pool.chamadas.some(c => c.sql.startsWith('INSERT INTO moderacoes')), false);
    assert.ok(pool.chamadas.some(c => c.sql.startsWith('INSERT INTO historico_status')));
  });
}
test('aviso imediato respeita canal desativado e destinatário ativo/verificado sem filtro de frequência/região', async () => {
  const pool = criarPoolFalso({ resultados: [{ affectedRows: 0 }] }); const c = await pool.getConnection();
  await registrarAtualizacao(c, { usuarioId: 8, tituloRelato: '🌧'.repeat(80), versao: '4294967295', decisao: 'aprovado' });
  const q = pool.chamadas[0];
  assert.match(q.sql, /COALESCE\(p.canal_sistema, 1\) = 1/); assert.match(q.sql, /u.status = 'ativo'/);
  assert.match(q.sql, /u.deleted_at IS NULL AND u.email_verificado_em IS NOT NULL/);
  assert.match(q.sql, /enviada_em/); assert.match(q.sql, /UTC_TIMESTAMP\(\)/);
  assert.doesNotMatch(q.sql, /frequencia|silencioso|preferencias_bairros|preferencias_categorias/);
  assert.ok(Array.from(q.parametros[2]).length <= 500);
});
test('situação sem mudança não cria histórico/aviso duplicado', async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 9 }], [relato]] });
  await criarModeracaoModel(pool).alterar({ ...pedido, situacao: 'aberto', statusAnterior: 'aberto' });
  assert.equal(pool.chamadas.some(c => c.sql.startsWith('INSERT') || c.sql.startsWith('UPDATE')), false);
});
test('falha de aviso reverte decisão ou situação/histórico, sem commit separado', async () => {
  for (const mudanca of [{ decisao: 'aprovado' }, { situacao: 'resolvido', statusAnterior: 'aberto' }]) {
    const pool = criarPoolFalso({ resultados: [[{ id: 9 }], [relato], [], {}, {}] }); const obter = pool.getConnection;
    pool.getConnection = async () => {
      const c = await obter(), consultar = c.query;
      c.query = async (sql, parametros) => { if (sql.startsWith('INSERT INTO notificacoes')) throw new Error('Falha ao gravar aviso'); return consultar(sql, parametros); };
      return c;
    };
    await assert.rejects(criarModeracaoModel(pool).alterar({ ...pedido, ...mudanca }), /Falha ao gravar aviso/);
    assert.equal(pool.chamadas.some(c => c.sql === 'COMMIT'), false);
    assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['ROLLBACK', 'RELEASE']);
  }
});
test('model lista só avisos entregues ao dono e não marca nada ao consultar', async () => {
  const pool = criarPoolFalso({ resultados: [[], [{ agora: data }], [{ id, usuario_id: 9, tipo: 'relato_aprovado', titulo: 'Aprovado', mensagem: 'Texto',
    created_at: data, enviada_em: data, lida_em: null, senha_hash: 'NUNCA' }], [{ total: '12', naoLidas: '3' }]] });
  const r = await criarNotificacaoModel(pool).listar({ usuarioId: 9, pagina: 2, limite: 10 });
  assert.equal(r.notificacoes[0].id, id); assert.equal(r.notificacoes[0].destino, '/meus-relatos');
  assert.equal(r.notificacoes[0].lidaEm, null); assert.equal('usuario_id' in r.notificacoes[0], false); assert.equal('senha_hash' in r.notificacoes[0], false);
  assert.deepEqual(r.resumo, { total: 12, naoLidas: 3 }); assert.deepEqual(r.paginacao, { pagina: 2, limite: 10, total: 12, paginas: 2 });
  assert.match(pool.chamadas[0].sql, /READ ONLY/); assert.match(pool.chamadas[3].sql, /CAST\(n.id AS CHAR\)/);
  assert.deepEqual(pool.chamadas[3].parametros, [9, data, 10, 10]); assert.deepEqual(pool.chamadas[4].parametros, [9, data]);
  assert.match(pool.chamadas[3].sql, /n.usuario_id = \? AND n.enviada_em IS NOT NULL AND n.enviada_em <= \?/);
  assert.equal(pool.chamadas.some(c => /^(INSERT|UPDATE|DELETE)\b/.test(c.sql)), false);
});
test('filtro não lidas usa contagem filtrada sem perder resumo global', async () => {
  const pool = criarPoolFalso({ resultados: [[], [{ agora: data }], [], [{ total: '12', naoLidas: '3' }]] });
  const r = await criarNotificacaoModel(pool).listar({ usuarioId: 9, somenteNaoLidas: true });
  assert.match(pool.chamadas[3].sql, /AND n.lida_em IS NULL/); assert.deepEqual(r.resumo, { total: 12, naoLidas: 3 });
  assert.equal(r.paginacao.total, 3); assert.equal(r.paginacao.paginas, 1);
});
test('marcar lida é transacional, restrito ao dono e devolve relógio do banco', async () => {
  const pool = criarPoolFalso({ resultados: [[{ lida_em: null }], { affectedRows: 1 }, [{ lida_em: data }]] });
  const r = await criarNotificacaoModel(pool).marcarLida({ usuarioId: 9, id });
  assert.deepEqual(r, { ok: true, id, lidaEm: data });
  for (const c of pool.chamadas.filter(c => /^(SELECT|UPDATE)/.test(c.sql))) assert.deepEqual(c.parametros, [id, 9]);
  assert.match(pool.chamadas[1].sql, /FOR UPDATE/); assert.match(pool.chamadas[2].sql, /UTC_TIMESTAMP\(\)/);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['COMMIT', 'RELEASE']);
});
test('repetir leitura preserva data original e não executa UPDATE', async () => {
  const pool = criarPoolFalso({ resultados: [[{ lida_em: data }]] });
  const r = await criarNotificacaoModel(pool).marcarLida({ usuarioId: 9, id }); assert.equal(r.lidaEm, data);
  assert.equal(pool.chamadas.some(c => c.sql.startsWith('UPDATE')), false);
});
test('notificação de outro usuário, inexistente ou não entregue recebe 404 sem UPDATE', async () => {
  const pool = criarPoolFalso({ resultados: [[]] });
  await assert.rejects(criarNotificacaoModel(pool).marcarLida({ usuarioId: 9, id }), { status: 404 });
  assert.match(pool.chamadas[1].sql, /usuario_id = \?/); assert.match(pool.chamadas[1].sql, /enviada_em <= UTC_TIMESTAMP/);
  assert.equal(pool.chamadas.some(c => c.sql.startsWith('UPDATE')), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['ROLLBACK', 'RELEASE']);
});
test('falha ao confirmar leitura reverte UPDATE em vez de anunciar sucesso', async () => {
  const pool = criarPoolFalso({ resultados: [[{ lida_em: null }], {}, []] });
  await assert.rejects(criarNotificacaoModel(pool).marcarLida({ usuarioId: 9, id }), /não confirmada/);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ['ROLLBACK', 'RELEASE']);
});
