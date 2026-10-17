const test = require("node:test");
const assert = require("node:assert/strict");
const { criarRelatoAutorModel } = require("../app/models/relatoAutorModel");
const { criarModeracaoModel } = require("../app/models/moderacaoModel");
const { criarPoolFalso } = require("./support/fakePool");
const original = { id: 10, versao_conteudo: 1, deleted_at: null, status: "resolvido",
  titulo: "Rua alagada", descricao: "Relato original", gravidade: "grave", categoria_id: 2,
  bairro_id: 85, cidade_id: 1, latitude: "-23.5500000", longitude: "-46.6300000", endereco_referencia: null };
const pedido = { publicId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", usuarioId: 7, versao: "1",
  titulo: "Título corrigido", descricao: "Relato original", gravidade: "grave", categoriaSlug: "alagamento",
  bairroId: 85, latitude: -23.55, longitude: -46.63, referencia: "" };
const usuario = [{ id: 7 }], categoria = [{ id: 2 }], bairro = [{ id: 85, cidade_id: 1 }], alterado = { affectedRows: 1 };

test("edição salva versão anterior e invalida publicação sem apagar moderação, votos ou situação", async () => {
  const pool = criarPoolFalso({ resultados: [usuario, [original], categoria, bairro, alterado, alterado] });
  const resultado = await criarRelatoAutorModel(pool).editar(pedido);
  assert.deepEqual(resultado, { publicId: pedido.publicId, versao: "2", status: "resolvido", alterado: true, publicado: false });
  assert.ok(pool.chamadas.every(c => c.rotulo === "conexao"));
  assert.match(pool.chamadas[2].sql, /public_id = \? AND usuario_id = \? FOR UPDATE/);
  assert.deepEqual(pool.chamadas[2].parametros, [pedido.publicId, 7]);
  const snapshot = pool.chamadas[5]; assert.match(snapshot.sql, /INSERT INTO relato_revisoes/);
  assert.equal(snapshot.parametros[0], 10); assert.equal(snapshot.parametros[1], 1);
  assert.equal(JSON.parse(snapshot.parametros[2]).titulo, original.titulo); assert.equal(snapshot.parametros[3], 7);
  const update = pool.chamadas[6]; assert.match(update.sql, /versao_conteudo = versao_conteudo \+ 1/);
  assert.match(update.sql, /usuario_id = \? AND versao_conteudo = \? AND deleted_at IS NULL/);
  assert.deepEqual(update.parametros.slice(-3), [10, 7, "1"]);
  assert.doesNotMatch(update.sql, /SET status|resolvido_em/);
  assert.equal(pool.chamadas.some(c => /DELETE|INSERT INTO moderacoes|UPDATE moderacoes|relato_votos/.test(c.sql)), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["COMMIT", "RELEASE"]);
});

test("salvar sem mudanças não cria revisão nem remove aprovação", async () => {
  const pool = criarPoolFalso({ resultados: [usuario, [original], categoria, bairro, [{ id: 10 }]] });
  const resultado = await criarRelatoAutorModel(pool).editar({ ...pedido, titulo: original.titulo });
  assert.equal(resultado.alterado, false); assert.equal(resultado.versao, "1"); assert.equal(resultado.publicado, true);
  assert.equal(pool.chamadas.some(c => /^(INSERT|UPDATE|DELETE)\b/.test(c.sql)), false);
});

for (const [nome, resultados, status] of [
  ["conta indisponível", [[]], 403],
  ["relato de terceiro ou inexistente", [usuario, []], 404],
  ["relato excluído", [usuario, [{ ...original, deleted_at: new Date() }]], 404],
  ["versão antiga em outra aba", [usuario, [{ ...original, versao_conteudo: 2 }]], 409],
  ["categoria inativa", [usuario, [original], []], 422],
  ["bairro/cidade inativo", [usuario, [original], categoria, []], 422],
]) test(`edição recusa ${nome} sem gravar`, async () => {
  const pool = criarPoolFalso({ resultados });
  await assert.rejects(criarRelatoAutorModel(pool).editar(pedido), { status });
  assert.equal(pool.chamadas.some(c => /^(INSERT|UPDATE|DELETE)\b/.test(c.sql)), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["ROLLBACK", "RELEASE"]);
});

test("coordenadas inválidas não acessam banco", async () => {
  const pool = criarPoolFalso();
  await assert.rejects(criarRelatoAutorModel(pool).editar({ ...pedido, latitude: NaN }), { status: 422 });
  assert.equal(pool.chamadas.length, 0);
});

test("falha ao atualizar reverte também o snapshot", async () => {
  const pool = criarPoolFalso({ resultados: [usuario, [original], categoria, bairro, alterado, { affectedRows: 0 }] });
  await assert.rejects(criarRelatoAutorModel(pool).editar(pedido), { status: 409 });
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["ROLLBACK", "RELEASE"]);
});

test("falha no histórico não chega ao update", async () => {
  const pool = criarPoolFalso({ resultados: [usuario, [original], categoria, bairro] });
  const obter = pool.getConnection;
  pool.getConnection = async () => {
    const conexao = await obter(), query = conexao.query;
    conexao.query = async (sql, params) => {
      if (sql.startsWith("INSERT INTO relato_revisoes")) throw new Error("Snapshot indisponível");
      return query(sql, params);
    }; return conexao;
  };
  await assert.rejects(criarRelatoAutorModel(pool).editar(pedido), /Snapshot/);
  assert.equal(pool.chamadas.some(c => c.sql.startsWith("UPDATE relatos")), false);
  assert.equal(pool.chamadas.at(-2).sql, "ROLLBACK");
});

test("limite de versão não causa overflow", async () => {
  const pool = criarPoolFalso({ resultados: [usuario, [{ ...original, versao_conteudo: 4294967295 }], categoria, bairro] });
  await assert.rejects(criarRelatoAutorModel(pool).editar({ ...pedido, versao: "4294967295" }), { status: 409 });
});

test("exclusão lógica preserva linha e todos os históricos", async () => {
  const pool = criarPoolFalso({ resultados: [usuario, [original], alterado] });
  assert.equal((await criarRelatoAutorModel(pool).excluir(pedido)).excluido, true);
  assert.match(pool.chamadas[3].sql, /UPDATE relatos SET deleted_at = UTC_TIMESTAMP\(\)/);
  assert.deepEqual(pool.chamadas[3].parametros, [10, 7, "1"]);
  assert.equal(pool.chamadas.some(c => /^(DELETE|INSERT)\b/.test(c.sql)), false);
});

test("exclusão repetida é idempotente para o próprio autor", async () => {
  const pool = criarPoolFalso({ resultados: [usuario, [{ ...original, deleted_at: new Date() }]] });
  assert.equal((await criarRelatoAutorModel(pool).excluir(pedido)).excluido, true);
  assert.equal(pool.chamadas.some(c => c.sql.startsWith("UPDATE")), false);
});

test("exclusão de terceiro e exclusão com versão antiga são recusadas", async () => {
  for (const [linhas, status] of [[[], 404], [[{ ...original, versao_conteudo: 2 }], 409]]) {
    const pool = criarPoolFalso({ resultados: [usuario, linhas] });
    await assert.rejects(criarRelatoAutorModel(pool).excluir(pedido), { status });
    assert.equal(pool.chamadas.some(c => c.sql.startsWith("UPDATE")), false);
  }
});

test("revisão de moderação zero não autoriza aprovar conteúdo editado enquanto pendente", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 9 }], [{ id: 10, status: "aberto", versao_conteudo: 2 }]] });
  await assert.rejects(criarModeracaoModel(pool).alterar({ publicId: pedido.publicId, moderadorId: 9,
    decisao: "aprovado", revisao: "0", versao: "1" }), { status: 409 });
  assert.equal(pool.chamadas.some(c => c.sql.startsWith("INSERT")), false);
});

test("aprovação nova se vincula à nova versão, não reaproveita revisão antiga", async () => {
  const pool = criarPoolFalso({ resultados: [[{ id: 9 }], [{ id: 10, usuario_id: 7, titulo: 'Rua alagada', status: "aberto", versao_conteudo: 2 }], [], alterado] });
  await criarModeracaoModel(pool).alterar({ publicId: pedido.publicId, moderadorId: 9,
    decisao: "aprovado", revisao: "0", versao: "2" });
  assert.deepEqual(pool.chamadas[3].parametros, [10, "2"]);
  assert.deepEqual(pool.chamadas[4].parametros, [10, 9, "aprovado", null, null, "2"]);
});
