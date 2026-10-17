const test = require("node:test");
const assert = require("node:assert/strict");
const { criarRecuperacaoSenhaModel } = require("../app/models/recuperacaoSenhaModel");
const { hashCodigo } = require("../app/helpers/codigoVerificacao");
const { criarPoolFalso } = require("./support/fakePool");

const usuario = { id: 7, email: "teste@example.com", status: "ativo", deleted_at: null };
const codigo = { id: 10, codigo_hash: hashCodigo("042917"), tentativas: 0, expirado: 0 };
const alterado = { affectedRows: 1 };
const pedido = { email: usuario.email, codigo: "042917", senhaHash: "bcrypt-novo" };
function preparar(resultados) {
  const pool = criarPoolFalso({ resultados });
  return { pool, model: criarRecuperacaoSenhaModel(pool) };
}
const mudouSenha = pool => pool.chamadas.some(({ sql }) => /UPDATE usuarios SET senha_hash/.test(sql));

test("recuperacao grava somente hash, invalida anteriores e respeita a finalidade", async () => {
  const { pool, model } = preparar([[usuario], [{ minuto: 0, hora: 0 }], alterado, { insertId: 10 }]);
  const expiraEm = new Date();
  assert.deepEqual(await model.emitirCodigo({ email: usuario.email, codigoHash: codigo.codigo_hash, expiraEm }), {
    usuarioId: 7, email: usuario.email,
  });
  assert.match(pool.chamadas[1].sql, /email = \? LIMIT 1 FOR UPDATE/);
  assert.deepEqual(pool.chamadas[1].parametros, [usuario.email]);
  assert.match(pool.chamadas[2].sql, /INTERVAL 60 SECOND/);
  assert.match(pool.chamadas[2].sql, /INTERVAL 1 HOUR/);
  assert.match(pool.chamadas[3].sql, /finalidade = 'recuperacao_senha'/);
  assert.match(pool.chamadas[4].sql, /'recuperacao_senha'/);
  assert.deepEqual(pool.chamadas[4].parametros, [7, codigo.codigo_hash, expiraEm]);
  assert.ok(pool.chamadas.every(c => c.rotulo === "conexao"));
  assert.equal(pool.chamadas.at(-2).sql, "COMMIT");
  assert.equal(mudouSenha(pool), false);
});

for (const contagens of [{ minuto: 1, hora: 1 }, { minuto: 0, hora: 5 }]) {
  test(`limite por conta não invalida o código atual: ${JSON.stringify(contagens)}`, async () => {
    const { pool, model } = preparar([[usuario], [contagens]]);
    assert.equal(await model.emitirCodigo({ email: usuario.email, codigoHash: codigo.codigo_hash, expiraEm: new Date() }), null);
    assert.equal(pool.chamadas.some(c => /^(UPDATE|INSERT)/.test(c.sql.trim())), false);
  });
}

for (const conta of [null, { ...usuario, status: "bloqueado" }, { ...usuario, status: "inativo" }, { ...usuario, deleted_at: new Date() }]) {
  test(`recuperacao não desbloqueia nem altera conta indisponível: ${conta?.status ?? "ausente"}`, async () => {
    const { pool, model } = preparar([conta ? [conta] : [], conta ? [conta] : []]);
    assert.equal(await model.emitirCodigo({ email: usuario.email }), null);
    assert.deepEqual(await model.redefinirSenha(pedido), { ok: false });
    assert.equal(pool.chamadas.some(c => /^(UPDATE|INSERT)/.test(c.sql.trim())), false);
  });
}

test("código correto troca senha e consome na mesma transação sem mudar papel/verificação", async () => {
  const { pool, model } = preparar([[usuario], [codigo], alterado, alterado]);
  assert.deepEqual(await model.redefinirSenha(pedido), { ok: true });
  assert.deepEqual(pool.chamadas.map(c => c.sql.split(/\s+/)[0]), ["BEGIN", "SELECT", "SELECT", "UPDATE", "UPDATE", "COMMIT", "RELEASE"]);
  assert.match(pool.chamadas[2].sql, /finalidade = 'recuperacao_senha'/);
  assert.match(pool.chamadas[2].sql, /consumido_em IS NULL/);
  assert.match(pool.chamadas[2].sql, /expira_em <= UTC_TIMESTAMP\(\)/);
  assert.match(pool.chamadas[2].sql, /FOR UPDATE/);
  assert.deepEqual(pool.chamadas[4].parametros, [pedido.senhaHash, 7]);
  assert.doesNotMatch(pool.chamadas[4].sql, /papel_id|email_verificado_em/);
});

test("código errado conta tentativa mas não troca a senha", async () => {
  const { pool, model } = preparar([[usuario], [codigo], alterado]);
  assert.deepEqual(await model.redefinirSenha({ ...pedido, codigo: "111111" }), { ok: false });
  assert.match(pool.chamadas[3].sql, /tentativas = tentativas \+ 1/);
  assert.equal(mudouSenha(pool), false);
});

test("quinta tentativa invalida código sem mudar senha", async () => {
  const { pool, model } = preparar([[usuario], [{ ...codigo, tentativas: 4 }], alterado, alterado]);
  assert.deepEqual(await model.redefinirSenha({ ...pedido, codigo: "111111" }), { ok: false });
  assert.match(pool.chamadas[4].sql, /SET consumido_em/);
  assert.equal(mudouSenha(pool), false);
});

for (const registro of [{ ...codigo, expirado: 1 }, { ...codigo, tentativas: 5 }]) {
  test(`código certo expirado/esgotado não muda senha: ${registro.expirado}/${registro.tentativas}`, async () => {
    const { pool, model } = preparar([[usuario], [registro], alterado]);
    assert.deepEqual(await model.redefinirSenha(pedido), { ok: false });
    assert.equal(mudouSenha(pool), false);
    assert.match(pool.chamadas[3].sql, /SET consumido_em/);
  });
}

test("código já usado, inexistente ou emitido para cadastro não autoriza recuperação", async () => {
  const { pool, model } = preparar([[usuario], []]);
  assert.deepEqual(await model.redefinirSenha(pedido), { ok: false });
  assert.equal(mudouSenha(pool), false);
  assert.match(pool.chamadas[2].sql, /finalidade = 'recuperacao_senha'/);
});

test("segunda confirmação não reutiliza o código consumido", async () => {
  const { pool, model } = preparar([[usuario], [codigo], alterado, alterado, [usuario], []]);
  assert.deepEqual(await model.redefinirSenha(pedido), { ok: true });
  assert.deepEqual(await model.redefinirSenha(pedido), { ok: false });
  assert.equal(pool.chamadas.filter(c => /UPDATE usuarios SET senha_hash/.test(c.sql)).length, 1);
});

test("falha de atualização desfaz também o consumo do código", async () => {
  const { pool, model } = preparar([[usuario], [codigo], alterado, { affectedRows: 0 }]);
  await assert.rejects(model.redefinirSenha(pedido), /Falha ao redefinir senha/);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["ROLLBACK", "RELEASE"]);
  assert.equal(pool.chamadas.some(c => c.sql === "COMMIT"), false);
});

test("falha ao consumir nunca chega à atualização da senha", async () => {
  const { pool, model } = preparar([[usuario], [codigo], { affectedRows: 0 }]);
  await assert.rejects(model.redefinirSenha(pedido), /Falha ao consumir/);
  assert.equal(mudouSenha(pool), false);
  assert.equal(pool.chamadas.at(-2).sql, "ROLLBACK");
});

test("formato de código inválido não consulta o banco", async () => {
  const { pool, model } = preparar([]);
  for (const valor of [null, [], "12345", "1234567", 123456]) {
    assert.deepEqual(await model.redefinirSenha({ ...pedido, codigo: valor }), { ok: false });
  }
  assert.equal(pool.chamadas.length, 0);
});
