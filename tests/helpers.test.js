const test = require("node:test");
const assert = require("node:assert/strict");

const {
  senhaValida,
  requisitosFaltando,
  gerarHash,
  conferirSenha,
} = require("../app/helpers/senha");
const {
  gerarCodigo,
  hashCodigo,
  codigoTemFormatoValido,
  mascararEmail,
  compararCodigo,
  calcularExpiracao,
  segundosRestantes,
  VALIDADE_MINUTOS,
} = require("../app/helpers/codigoVerificacao");
const { normalizar, criarSlug } = require("../app/helpers/normalizar");

// ---------------------------------------------------------------------------
// Senha: a mesma regra usada pelo validador do cadastro e pela força no front
// ---------------------------------------------------------------------------
test("aceita senha com maiuscula, minuscula, numero e simbolo", () => {
  assert.equal(senhaValida("Clima2026!"), true);
  assert.deepEqual(requisitosFaltando("Clima2026!"), []);
});

test("recusa senha fraca e informa o que falta", () => {
  assert.equal(senhaValida("senha"), false);
  const faltando = requisitosFaltando("senha").map((requisito) => requisito.id);
  assert.ok(faltando.includes("len"));
  assert.ok(faltando.includes("upper"));
  assert.ok(faltando.includes("number"));
  assert.ok(faltando.includes("symbol"));
});

test("gera hash e confere a senha sem guardar texto puro", async () => {
  const hash = await gerarHash("Clima2026!");

  assert.notEqual(hash, "Clima2026!");
  assert.equal(await conferirSenha("Clima2026!", hash), true);
  assert.equal(await conferirSenha("outra-senha", hash), false);
  assert.equal(await conferirSenha("Clima2026!", null), false);
});

// ---------------------------------------------------------------------------
// Código de verificação
// ---------------------------------------------------------------------------
test("o codigo tem 6 digitos e o hash tem 64 caracteres (CHAR(64) do banco)", () => {
  const codigo = gerarCodigo();

  assert.match(codigo, /^\d{6}$/);
  assert.equal(codigoTemFormatoValido(codigo), true);
  assert.equal(hashCodigo(codigo).length, 64);
  assert.notEqual(hashCodigo(codigo), codigo);
});

test("recusa formato de codigo invalido", () => {
  assert.equal(codigoTemFormatoValido("12345"), false);
  assert.equal(codigoTemFormatoValido("1234567"), false);
  assert.equal(codigoTemFormatoValido("abcdef"), false);
  assert.equal(codigoTemFormatoValido(undefined), false);
});

test("compara o codigo informado com o hash gravado", () => {
  const codigo = "042917";
  const hash = hashCodigo(codigo);

  assert.equal(compararCodigo(codigo, hash), true);
  assert.equal(compararCodigo("042918", hash), false);
  assert.equal(compararCodigo(codigo, null), false);
});

test("mascara o email mostrado na tela de verificacao", () => {
  assert.equal(mascararEmail("sergio.silva@gmail.com"), "se***@gmail.com");
  assert.equal(mascararEmail("invalido"), "***");
});

test("o codigo expira em 5 minutos e o tempo restante e calculado", () => {
  const agora = new Date("2026-01-01T12:00:00Z");
  const expiraEm = calcularExpiracao(agora);

  assert.equal(VALIDADE_MINUTOS, 5);
  assert.equal(segundosRestantes(expiraEm, agora), 300);
  assert.equal(segundosRestantes(expiraEm, new Date("2026-01-01T12:05:01Z")), 0);
});

// ---------------------------------------------------------------------------
// Normalização de nomes
// ---------------------------------------------------------------------------
test("cria slug no mesmo padrao do banco", () => {
  assert.equal(criarSlug("Freguesia do Ó"), "freguesia-do-o");
  assert.equal(normalizar("  São   Paulo "), "sao paulo");
});
