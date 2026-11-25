const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../app/models/verificacaoModel");
const email = require("../app/services/emailService");
const { emitirCodigoCadastro } = require("../app/services/verificacaoEmailService");
const { compararCodigo } = require("../app/helpers/codigoVerificacao");

test("emissao grava hash antes do envio e retorna a expiracao realmente gravada", async t => {
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
test("falha do provedor nao perde a expiracao nem vaza detalhes", async t => {
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
test("falha do banco propaga sem tentar enviar e-mail", async t => {
  const falha = new Error("Falha simulada no banco");
  let envios = 0;
  t.mock.method(model, "criarCodigo", async () => { throw falha; });
  t.mock.method(email, "enviarCodigoVerificacao", async () => { envios++; });
  await assert.rejects(emitirCodigoCadastro({ usuarioId: 7, email: "pessoa@example.com" }), falha);
  assert.equal(envios, 0);
});
test("configuracao Brevo ausente falha sem registrar mensagem ou credenciais", async t => {
  const nomes = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"];
  const anteriores = Object.fromEntries(nomes.map(nome => [nome, process.env[nome]]));
  const logs = [];
  t.mock.method(console, "error", (...dados) => logs.push(dados));
  for (const nome of nomes) delete process.env[nome];
  try {
    await assert.rejects(
      email.enviarEmail({ para: "pessoa@example.com", assunto: "Teste", texto: "codigo-ficticio" }),
      { code: "BREVO_CONFIG_INCOMPLETA" }
    );
    assert.match(JSON.stringify(logs), /BREVO_API_KEY/);
    assert.doesNotMatch(JSON.stringify(logs), /codigo-ficticio|xkeysib-/);
  } finally {
    for (const nome of nomes) {
      if (anteriores[nome] === undefined) delete process.env[nome];
      else process.env[nome] = anteriores[nome];
    }
  }
});

test("envia conteúdo HTML e texto pela API HTTPS do Brevo", async t => {
  const nomes = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"];
  const anteriores = Object.fromEntries(nomes.map(nome => [nome, process.env[nome]]));
  process.env.BREVO_API_KEY = "xkeysib-fake-test-key";
  process.env.BREVO_SENDER_EMAIL = "nao-responder@example.com";
  process.env.BREVO_SENDER_NAME = "ClimaFy";
  const requisicoes = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requisicoes.push({ url: String(url), options });
    return new Response(JSON.stringify({ messageId: "<teste-brevo@example.com>" }), {
      status: 201, headers: { "content-type": "application/json" },
    });
  });
  try {
    const resultado = await email.enviarEmail({
      para: "pessoa@example.com", assunto: "Assunto de teste", texto: "Conteúdo simples", html: "<p>Conteúdo HTML</p>",
    });
    const corpo = JSON.parse(requisicoes[0].options.body);
    assert.match(requisicoes[0].url, /^https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
    assert.equal(new Headers(requisicoes[0].options.headers).get("api-key"), "xkeysib-fake-test-key");
    assert.deepEqual(corpo.sender, { email: "nao-responder@example.com", name: "ClimaFy" });
    assert.deepEqual(corpo.to, [{ email: "pessoa@example.com" }]);
    assert.equal(corpo.subject, "Assunto de teste");
    assert.equal(corpo.textContent, "Conteúdo simples");
    assert.equal(corpo.htmlContent, "<p>Conteúdo HTML</p>");
    assert.deepEqual(resultado, { enviado: true, messageId: "<teste-brevo@example.com>" });

    await email.enviarEmail({ para: "pessoa@example.com", assunto: "Somente texto", texto: "Versão simples" });
    const somenteTexto = JSON.parse(requisicoes[1].options.body);
    assert.equal(somenteTexto.textContent, "Versão simples");
    assert.equal("htmlContent" in somenteTexto, false);
  } finally {
    for (const nome of nomes) {
      if (anteriores[nome] === undefined) delete process.env[nome];
      else process.env[nome] = anteriores[nome];
    }
  }
});

test("erro do Brevo registra apenas categoria segura e não devolve detalhes da API", async t => {
  const nomes = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"];
  const anteriores = Object.fromEntries(nomes.map(nome => [nome, process.env[nome]]));
  process.env.BREVO_API_KEY = "xkeysib-fake-test-key";
  process.env.BREVO_SENDER_EMAIL = "nao-responder@example.com";
  process.env.BREVO_SENDER_NAME = "ClimaFy";
  const logs = [];
  t.mock.method(console, "error", (...dados) => logs.push(dados));
  t.mock.method(globalThis, "fetch", async () => new Response(
    JSON.stringify({ message: "detalhe-interno-ficticio" }),
    { status: 401, headers: { "content-type": "application/json" } }
  ));
  try {
    await assert.rejects(
      email.enviarEmail({ para: "pessoa@example.com", assunto: "Teste", texto: "Conteúdo" }),
      erro => erro.code === "BREVO_ENVIO_FALHOU" && !erro.message.includes("detalhe-interno")
    );
    assert.match(JSON.stringify(logs), /HTTP 401.*chave de API inválida/);
    assert.doesNotMatch(JSON.stringify(logs), /xkeysib-|detalhe-interno-ficticio/);
  } finally {
    for (const nome of nomes) {
      if (anteriores[nome] === undefined) delete process.env[nome];
      else process.env[nome] = anteriores[nome];
    }
  }
});

test("remetente não verificado gera diagnóstico sem registrar detalhes do provedor", async t => {
  const nomes = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"];
  const anteriores = Object.fromEntries(nomes.map(nome => [nome, process.env[nome]]));
  process.env.BREVO_API_KEY = "xkeysib-fake-test-key";
  process.env.BREVO_SENDER_EMAIL = "nao-responder@example.com";
  process.env.BREVO_SENDER_NAME = "ClimaFy";
  const logs = [];
  t.mock.method(console, "error", (...dados) => logs.push(dados));
  t.mock.method(globalThis, "fetch", async () => new Response(
    JSON.stringify({ message: "Sender no-reply@private.example is not verified" }),
    { status: 400, headers: { "content-type": "application/json" } }
  ));
  try {
    await assert.rejects(
      email.enviarEmail({ para: "pessoa@example.com", assunto: "Teste", texto: "Conteúdo" }),
      { code: "BREVO_ENVIO_FALHOU" }
    );
    assert.match(JSON.stringify(logs), /remetente não autorizado ou não verificado/);
    assert.doesNotMatch(JSON.stringify(logs), /private\.example|xkeysib-/);
  } finally {
    for (const nome of nomes) {
      if (anteriores[nome] === undefined) delete process.env[nome];
      else process.env[nome] = anteriores[nome];
    }
  }
});
