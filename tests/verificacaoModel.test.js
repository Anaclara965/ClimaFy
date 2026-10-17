const test = require("node:test");
const assert = require("node:assert/strict");
const { criarVerificacaoModel } = require("../app/models/verificacaoModel");
const { hashCodigo } = require("../app/helpers/codigoVerificacao");
const { criarPoolFalso } = require("./support/fakePool");

const usuario = { id: 1, status: "ativo", email_verificado_em: null, deleted_at: null };
const codigo = { id: 10, codigo_hash: hashCodigo("042917"), tentativas: 0, expirado: 0 };
const alterado = { affectedRows: 1 };
const pedido = { usuarioId: 1, codigo: "042917" };

function preparar(resultados) {
  const pool = criarPoolFalso({ resultados });
  return { pool, model: criarVerificacaoModel(pool) };
}

function foiAtivado(pool) {
  return pool.chamadas.some(({ sql }) => /UPDATE usuarios SET email_verificado_em/.test(sql));
}

test("codigo correto consome e ativa na mesma conexao, com travas e commit", async () => {
  const { pool, model } = preparar([[usuario], [codigo], alterado, alterado]);
  assert.deepEqual(await model.confirmarCadastro(pedido), { ok: true });
  assert.deepEqual(pool.chamadas.map(({ sql }) => sql.split(/\s+/)[0]), [
    "BEGIN", "SELECT", "SELECT", "UPDATE", "UPDATE", "COMMIT", "RELEASE",
  ]);
  assert.ok(pool.chamadas.every(({ rotulo }) => rotulo === "conexao"));
  assert.match(pool.chamadas[1].sql, /FOR UPDATE/);
  assert.match(pool.chamadas[2].sql, /FOR UPDATE/);
  assert.match(pool.chamadas[2].sql, /finalidade = 'cadastro'/);
  assert.match(pool.chamadas[2].sql, /consumido_em IS NULL/);
  assert.match(pool.chamadas[2].sql, /expira_em <= UTC_TIMESTAMP\(\)/);
  assert.deepEqual(pool.chamadas[2].parametros, [1]);
});

test("codigo errado conta uma tentativa sem ativar o usuario", async () => {
  const { pool, model } = preparar([[usuario], [codigo], alterado]);
  assert.deepEqual(await model.confirmarCadastro({ ...pedido, codigo: "000000" }), {
    ok: false, motivo: "incorreto", restantes: 4,
  });
  assert.equal(foiAtivado(pool), false);
  assert.match(pool.chamadas[3].sql, /tentativas = tentativas \+ 1/);
  assert.equal(pool.chamadas.at(-2).sql, "COMMIT");
});

test("quinta tentativa errada ja invalida o codigo", async () => {
  const { pool, model } = preparar([[usuario], [{ ...codigo, tentativas: 4 }], alterado, alterado]);
  assert.deepEqual(await model.confirmarCadastro({ ...pedido, codigo: "000000" }), {
    ok: false, motivo: "tentativas", restantes: 0,
  });
  assert.match(pool.chamadas[4].sql, /SET consumido_em/);
  assert.equal(foiAtivado(pool), false);
});

for (const [nome, registro, motivo] of [
  ["expirado", { ...codigo, expirado: 1 }, "expirado"],
  ["com tentativas esgotadas", { ...codigo, tentativas: 5 }, "tentativas"],
]) {
  test(`mesmo o codigo correto e recusado se estiver ${nome}`, async () => {
    const { pool, model } = preparar([[usuario], [registro], alterado]);
    const resultado = await model.confirmarCadastro(pedido);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.motivo, motivo);
    assert.match(pool.chamadas[3].sql, /SET consumido_em/);
    assert.equal(foiAtivado(pool), false);
  });
}

test("codigo inexistente ou ja consumido nao ativa conta", async () => {
  const { pool, model } = preparar([[usuario], []]);
  assert.deepEqual(await model.confirmarCadastro(pedido), { ok: false, motivo: "sem_codigo" });
  assert.equal(foiAtivado(pool), false);
});

for (const conta of [null, { ...usuario, status: "bloqueado" }, { ...usuario, status: "inativo" }, { ...usuario, deleted_at: "2026-09-27" }]) {
  test(`nao verifica conta indisponivel: ${JSON.stringify(conta)}`, async () => {
    const { pool, model } = preparar([conta ? [conta] : []]);
    assert.deepEqual(await model.confirmarCadastro(pedido), { ok: false, motivo: "conta_indisponivel" });
    assert.equal(pool.chamadas.length, 4); // BEGIN, SELECT usuario, COMMIT, RELEASE
  });
}

test("segunda confirmacao da conta nao reutiliza o codigo", async () => {
  const { pool, model } = preparar([
    [usuario], [codigo], alterado, alterado,
    [{ ...usuario, email_verificado_em: "2026-09-27" }],
  ]);
  assert.deepEqual(await model.confirmarCadastro(pedido), { ok: true });
  assert.deepEqual(await model.confirmarCadastro(pedido), { ok: false, motivo: "ja_verificado" });
  assert.equal(pool.chamadas.filter(({ sql }) => /UPDATE usuarios/.test(sql)).length, 1);
});

test("formato invalido nem abre conexao", async () => {
  const { pool, model } = preparar([]);
  for (const entrada of ["12345", "1234567", "abcdef", undefined, ["042917"]]) {
    assert.deepEqual(await model.confirmarCadastro({ usuarioId: 1, codigo: entrada }), {
      ok: false, motivo: "formato",
    });
  }
  assert.equal(pool.chamadas.length, 0);
});

test("falha ao ativar solicita rollback tambem do consumo do codigo", async () => {
  const { pool, model } = preparar([[usuario], [codigo], alterado, { affectedRows: 0 }]);
  await assert.rejects(model.confirmarCadastro(pedido), /Conta nao pode ser verificada/);
  assert.deepEqual(pool.chamadas.slice(-2).map(({ sql }) => sql), ["ROLLBACK", "RELEASE"]);
  assert.equal(pool.chamadas.some(({ sql }) => sql === "COMMIT"), false);
});

test("falha ao consumir codigo nao chega a ativar conta", async () => {
  const { pool, model } = preparar([[usuario], [codigo], { affectedRows: 0 }]);
  await assert.rejects(model.confirmarCadastro(pedido), /Codigo nao pode ser consumido/);
  assert.equal(foiAtivado(pool), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(({ sql }) => sql), ["ROLLBACK", "RELEASE"]);
});

test("criacao trava a mesma conta antes de invalidar e inserir codigos", async () => {
  const { pool, model } = preparar([[{ id: 1 }], alterado, { insertId: 10 }]);
  const id = await model.criarCodigo({
    usuarioId: 1, codigoHash: codigo.codigo_hash, finalidade: "cadastro", expiraEm: new Date(),
  });
  assert.equal(id, 10);
  assert.match(pool.chamadas[1].sql, /SELECT id FROM usuarios WHERE id = \? FOR UPDATE/);
  assert.equal(pool.chamadas[2].sql.trim().startsWith("UPDATE"), true);
  assert.equal(pool.chamadas[3].sql.trim().startsWith("INSERT"), true);
});
