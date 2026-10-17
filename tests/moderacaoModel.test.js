const test = require("node:test");
const assert = require("node:assert/strict");
const { criarPoolFalso } = require("./support/fakePool");
const { criarModeracaoModel } = require("../app/models/moderacaoModel");
const { criarRelatoConsultaModel } = require("../app/models/relatoConsultaModel");
const dados = { publicId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", moderadorId: 7,
  decisao: "aprovado", revisao: "0", versao: "1" };

test("aprovar insere decisao sem resolver o problema", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 7 }], [{ id: 10, usuario_id: 8, titulo: 'Rua alagada', status: "aberto", versao_conteudo: 1 }], [], {}] });
  await criarModeracaoModel(pool).alterar(dados);
  assert.match(pool.chamadas[1].sql, /JOIN papeis p ON p.id = u.papel_id/);
  assert.match(pool.chamadas[1].sql, /p.codigo IN.*moderador/);
  assert.match(pool.chamadas[2].sql, /FOR UPDATE/);
  assert.deepEqual(pool.chamadas[4].parametros, [10, 7, "aprovado", null, null, "1"]);
  assert.equal(pool.chamadas.some(c => c.sql.startsWith("UPDATE relatos")), false);
  assert.equal(pool.chamadas.some(c => c.sql.includes("historico_status")), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["COMMIT", "RELEASE"]);
});
test("rejeicao exige motivo ativo e preserva a situacao", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 7 }], [{ id: 10, usuario_id: 8, titulo: 'Rua alagada', status: "em_andamento", versao_conteudo: 1 }], [{ id: 8 }], [{ id: 4 }], {}] });
  await criarModeracaoModel(pool).alterar({ ...dados, revisao: "8", decisao: "rejeitado", motivo: "duplicado", observacao: "Teste" });
  assert.deepEqual(pool.chamadas[4].parametros, ["duplicado"]);
  assert.deepEqual(pool.chamadas[5].parametros, [10, 7, "rejeitado", 4, "Teste", "1"]);
  assert.equal(pool.chamadas.some(c => c.sql.startsWith("UPDATE")), false);
});
for (const [nome, resultados, status] of [
  ["papel sem permissao", [[]], 403],
  ["relato ausente ou excluido", [[{ id: 7 }], []], 404],
  ["revisao desatualizada", [[{ id: 7 }], [{ id: 10, versao_conteudo: 1 }], [{ id: 9 }]], 409],
  ["motivo inexistente", [[{ id: 7 }], [{ id: 10, versao_conteudo: 1 }], [], []], 422],
  ["conteúdo editado desde a leitura", [[{ id: 7 }], [{ id: 10, versao_conteudo: 2 }]], 409],
]) test(`moderação recusa ${nome} e faz rollback`, async () => {
  const pool = criarPoolFalso({ resultados });
  await assert.rejects(criarModeracaoModel(pool).alterar({ ...dados, decisao: "rejeitado", motivo: "duplicado" }), { status });
  assert.equal(pool.chamadas.some(c => c.sql.startsWith("INSERT")), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["ROLLBACK", "RELEASE"]);
});
test("resolver altera situacao e grava historico atomicamente", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 7 }], [{ id: 10, usuario_id: 8, titulo: 'Rua alagada', status: "aberto", versao_conteudo: 1 }], {}, {}] });
  await criarModeracaoModel(pool).alterar({ ...dados, situacao: "resolvido", statusAnterior: "aberto", observacao: "Concluído" });
  assert.deepEqual(pool.chamadas[3].parametros, ["resolvido", "resolvido", 10]);
  assert.match(pool.chamadas[3].sql, /resolvido_em.*CASE/s);
  assert.deepEqual(pool.chamadas[4].parametros, [10, "aberto", "resolvido", 7, "Concluído"]);
  assert.equal(pool.chamadas.some(c => c.sql.includes("INSERT INTO moderacoes_relato")), false);
});
test("situacao concorrente recebe 409 sem gravar", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 7 }], [{ id: 10, status: "resolvido", versao_conteudo: 1 }]] });
  await assert.rejects(criarModeracaoModel(pool).alterar({ ...dados, situacao: "em_andamento", statusAnterior: "aberto" }), { status: 409 });
  assert.equal(pool.chamadas.some(c => c.sql.startsWith("UPDATE")), false);
});
test("falha no historico reverte mudanca de situacao", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 7 }], [{ id: 10, status: "aberto", versao_conteudo: 1 }], {}] });
  const adquirir = pool.getConnection;
  pool.getConnection = async () => {
    const conexao = await adquirir(); const query = conexao.query;
    conexao.query = (sql, params) => {
      if (sql.includes("INSERT INTO historico")) throw new Error("Falha simulada");
      return query(sql, params);
    }; return conexao;
  };
  await assert.rejects(criarModeracaoModel(pool).alterar({ ...dados, situacao: "resolvido", statusAnterior: "aberto" }));
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["ROLLBACK", "RELEASE"]);
});
test("listagem publica usa view em todos os dados e parametriza filtros", async () => {
  const pool = criarPoolFalso({ resultados: [[], [{ total: 0 }], [{ total: 0 }], [], [], [], []] });
  const resultado = await criarRelatoConsultaModel(pool).listar({ pagina: 2, limite: 12, busca: "x%_'", categoria: "lixo", status: "aberto", bairro: 3, dias: 7, ordem: "votes" });
  assert.ok(pool.chamadas.every(c => c.sql.includes("vw_relatos_publicos")));
  assert.deepEqual(pool.chamadas[0].parametros, ["%x!%!_'%", "%x!%!_'%", "%x!%!_'%", "aberto", "lixo", 3, 7, 12, 12]);
  assert.equal(pool.chamadas[0].sql.includes("x%_'"), false);
  assert.equal(resultado.paginacao.total, 0);
  assert.deepEqual(resultado.destaques, []);
  assert.deepEqual(resultado.porBairro, []);
});

test("destaques e concentracao usam todos os publicados, sem misturar filtros da pagina", async () => {
  const registro = { public_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", titulo: "Rua alagada",
    descricao: "Água acumulada", gravidade: "grave", status: "aberto", latitude: "-23.55", longitude: "-46.63",
    categoria: "Alagamento", categoria_slug: "alagamento", bairro: "Brás", bairro_id: 3,
    cidade: "São Paulo", votos: "4", created_at: new Date() };
  const pool = criarPoolFalso({ resultados: [[], [{ total: 0 }], [{ total: 1 }], [], [],
    [registro], [{ id: 3, nome: "Brás", total: "1" }]] });
  const resultado = await criarRelatoConsultaModel(pool).listar({ busca: "outro assunto" });
  assert.equal(resultado.relatos.length, 0);
  assert.equal(resultado.destaques[0].publicId, registro.public_id);
  assert.equal(resultado.destaques[0].votos, 4);
  assert.deepEqual(resultado.porBairro, [{ id: 3, nome: "Brás", total: 1 }]);
  assert.match(pool.chamadas[5].sql, /ORDER BY votos DESC.*LIMIT 2/);
  assert.match(pool.chamadas[6].sql, /WHERE r.status = 'aberto'.*GROUP BY.*LIMIT 8/);
  assert.ok(pool.chamadas.every(c => c.sql.includes("vw_relatos_publicos")));
  assert.equal(pool.chamadas[5].parametros, undefined);
  assert.equal(pool.chamadas[6].parametros, undefined);
});
test("detalhe publico nunca consulta pendentes; detalhe do autor exige propriedade", async () => {
  const pool = criarPoolFalso({ resultados: [[], []] }); const model = criarRelatoConsultaModel(pool);
  assert.equal(await model.buscarPublico(dados.publicId), null);
  assert.equal(await model.buscarPrivado(dados.publicId, { autorId: 7 }), null);
  assert.match(pool.chamadas[0].sql, /FROM vw_relatos_publicos/);
  assert.match(pool.chamadas[1].sql, /AND r.usuario_id = \?/);
  assert.deepEqual(pool.chamadas[1].parametros, [dados.publicId, 7]);
});
