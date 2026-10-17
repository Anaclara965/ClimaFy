const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../app/models/verificacaoModel");
const email = require("../app/services/emailService");
const { emitirCodigoCadastro } = require("../app/services/verificacaoEmailService");
const { compararCodigo } = require("../app/helpers/codigoVerificacao");

test("emissao grava hash antes do SMTP e retorna a expiracao realmente gravada", async t => {
  let gravado;
  t.mock.method(model, "criarCodigo", async dados => { gravado = dados; });
  t.mock.method(email, "enviarCodigoVerificacao", async (destino, codigo, opcoes) => {
    assert.equal(destino, "pessoa@example.com");
    assert.equal(gravado.usuarioId, 7); assert.equal(gravado.finalidade, "cadastro");
    assert.match(gravado.codigoHash, /^[0-9a-f]{64}$/);
    assert.equal(compararCodigo(codigo, gravado.codigoHash), true);
    assert.deepEqual(opcoes, { finalidade: "cadastro" });
    return { enviado: true };
  });
  const resultado = await emitirCodigoCadastro({ usuarioId: 7, email: "pessoa@example.com" });
  assert.equal(resultado.enviado, true); assert.equal(resultado.expiraEm, gravado.expiraEm);
});
test("SMTP rejeitado nao perde a expiracao nem vaza detalhes do provedor", async t => {
  const logs = [];
  t.mock.method(console, "warn", (...dados) => logs.push(dados));
  t.mock.method(model, "criarCodigo", async () => {});
  t.mock.method(email, "enviarCodigoVerificacao", async () => { throw new Error("detalhes-sensiveis-ficticios"); });
  const resultado = await emitirCodigoCadastro({ usuarioId: 7, email: "pessoa@example.com" });
  assert.equal(resultado.enviado, false); assert.ok(resultado.expiraEm instanceof Date);
  assert.equal(JSON.stringify(logs).includes("detalhes-sensiveis"), false);
});
test("retorno enviado:false nunca e anunciado como entrega confirmada", async t => {
  t.mock.method(model, "criarCodigo", async () => {});
  t.mock.method(email, "enviarCodigoVerificacao", async () => ({ enviado: false, motivo: "smtp-nao-configurado" }));
  assert.equal((await emitirCodigoCadastro({ usuarioId: 7, email: "pessoa@example.com" })).enviado, false);
});
test("falha do banco propaga sem chamar SMTP", async t => {
  const falha = new Error("Falha simulada no banco");
  let envios = 0;
  t.mock.method(model, "criarCodigo", async () => { throw falha; });
  t.mock.method(email, "enviarCodigoVerificacao", async () => { envios++; });
  await assert.rejects(emitirCodigoCadastro({ usuarioId: 7, email: "pessoa@example.com" }), falha);
  assert.equal(envios, 0);
});
test("producao sem SMTP nao imprime mensagem ou codigo em modo desenvolvimento", async t => {
  const ambiente = process.env.NODE_ENV, host = process.env.SMTP_HOST;
  const logs = [];
  t.mock.method(console, "log", (...dados) => logs.push(dados));
  process.env.NODE_ENV = "production"; delete process.env.SMTP_HOST;
  try {
    await assert.rejects(email.enviarEmail({ para: "pessoa@example.com", assunto: "Teste", texto: "codigo-ficticio" }), { code: "SMTP_NAO_CONFIGURADO" });
    assert.equal(logs.length, 0);
  } finally {
    if (ambiente === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = ambiente;
    if (host === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = host;
  }
});
