const test = require("node:test");
const assert = require("node:assert/strict");
const { criarUsuarioModel } = require("../app/models/usuarioModel");
const { criarPoolFalso } = require("./support/fakePool");

test("dados pessoais privados são consultados somente pelo método de perfil", async () => {
  const pool = criarPoolFalso({ resultados: [
    [{ id: 5, nome: "Ana", email: "ana@example.com" }],
    [{ id: 5, telefone: "5511999999999", foto_perfil_chave: null, papel: "administrador" }],
    [{ id: 5, nome: "Ana", email: "ana@example.com", tem_foto_perfil: 1 }],
  ] });
  const model = criarUsuarioModel(pool);

  await model.buscarPorId(5);
  assert.doesNotMatch(pool.chamadas[0].sql, /email_pendente|telefone|foto_perfil/);
  await model.buscarPerfilPorId(5);
  assert.match(pool.chamadas[1].sql, /email_pendente/);
  assert.match(pool.chamadas[1].sql, /telefone/);
  assert.match(pool.chamadas[1].sql, /foto_perfil_chave/);
  assert.match(pool.chamadas[1].sql, /p\.codigo AS papel/);
  assert.match(pool.chamadas[1].sql, /JOIN papeis/);
  const usuarioLogin = await model.buscarPorEmail("ANA@example.com");
  assert.equal(usuarioLogin.tem_foto_perfil, 1);
  assert.match(pool.chamadas[2].sql, /AS tem_foto_perfil/);
  assert.doesNotMatch(pool.chamadas[0].sql, /foto_perfil/);
  assert.match(pool.chamadas[1].sql, /foto_perfil_chave/);
});
