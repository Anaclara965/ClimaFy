const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../app/models/verificacaoModel");
const { confirmarCodigo } = require("../app/controllers/verificacaoControllers");

function requisicao() {
  return {
    body: { codigo: "042917", usuarioId: 999 },
    session: { cadastroPendente: { usuarioId: 1, email: "mariana@example.com" } },
  };
}
function resposta() {
  return {
    status(codigo) { this.statusCode = codigo; return this; },
    json(corpo) { this.corpo = corpo; return this; },
  };
}

test("controller usa identidade da sessao e so limpa cadastro apos confirmar", async (t) => {
  const req = requisicao();
  const res = resposta();
  t.mock.method(model, "confirmarCadastro", async (dados) => {
    assert.deepEqual(dados, { usuarioId: 1, codigo: "042917" });
    assert.ok(req.session.cadastroPendente);
    assert.equal(res.corpo, undefined);
    return { ok: true };
  });
  await confirmarCodigo(req, res, assert.fail);
  assert.equal(req.session.cadastroPendente, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.corpo.ok, true);
  assert.match(res.corpo.redirecionar, /^\/login\?/);
});

test("codigo rejeitado mantem etapa pendente e nao anuncia sucesso", async (t) => {
  const req = requisicao();
  const res = resposta();
  t.mock.method(model, "confirmarCadastro", async () => ({ ok: false, motivo: "expirado" }));
  await confirmarCodigo(req, res, assert.fail);
  assert.equal(res.statusCode, 422);
  assert.match(res.corpo.erros[0], /expirou/);
  assert.ok(req.session.cadastroPendente);
  assert.equal(res.corpo.redirecionar, undefined);
});

test("falha da transacao chega ao handler sem limpar a etapa pendente", async (t) => {
  const req = requisicao();
  const res = resposta();
  const falha = new Error("Falha simulada no COMMIT");
  let recebido;
  t.mock.method(model, "confirmarCadastro", async () => { throw falha; });
  await confirmarCodigo(req, res, (erro) => { recebido = erro; });
  assert.equal(recebido, falha);
  assert.ok(req.session.cadastroPendente);
  assert.equal(res.corpo, undefined);
});
