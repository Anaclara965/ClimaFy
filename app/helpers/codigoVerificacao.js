// Codigo de verificacao por e-mail (OTP de 6 digitos).
// O codigo NUNCA e gravado em texto puro: o banco guarda apenas o SHA-256
// (codigos_verificacao_email.codigo_hash e CHAR(64)).
const crypto = require("node:crypto");

const TAMANHO_CODIGO = 6;
const VALIDADE_MINUTOS = 5;
const MAX_TENTATIVAS = 5;
const COOLDOWN_REENVIO_SEGUNDOS = 60;

function gerarCodigo() {
  // randomInt e criptograficamente seguro (nao use Math.random aqui).
  const maximo = 10 ** TAMANHO_CODIGO;
  return String(crypto.randomInt(0, maximo)).padStart(TAMANHO_CODIGO, "0");
}

function hashCodigo(codigo) {
  return crypto.createHash("sha256").update(String(codigo)).digest("hex");
}

function codigoTemFormatoValido(codigo) {
  return /^\d{6}$/.test(String(codigo ?? ""));
}

function calcularExpiracao(agora = new Date()) {
  return new Date(agora.getTime() + VALIDADE_MINUTOS * 60 * 1000);
}

function segundosRestantes(expiraEm, agora = new Date()) {
  return Math.max(0, Math.floor((new Date(expiraEm).getTime() - agora.getTime()) / 1000));
}

// "sergio.silva@gmail.com" -> "se***@gmail.com" (usado na tela de verificacao)
function mascararEmail(email = "") {
  const [usuario, dominio] = String(email).split("@");
  if (!dominio) return "***";
  const visivel = usuario.slice(0, 2).padEnd(2, "*");
  return `${visivel}***@${dominio}`;
}

function compararCodigo(codigo, hashGravado) {
  const esperado = Buffer.from(String(hashGravado ?? ""), "utf8");
  const recebido = Buffer.from(hashCodigo(codigo), "utf8");
  if (esperado.length !== recebido.length) return false;
  return crypto.timingSafeEqual(esperado, recebido);
}

module.exports = {
  TAMANHO_CODIGO,
  VALIDADE_MINUTOS,
  MAX_TENTATIVAS,
  COOLDOWN_REENVIO_SEGUNDOS,
  gerarCodigo,
  hashCodigo,
  codigoTemFormatoValido,
  calcularExpiracao,
  segundosRestantes,
  mascararEmail,
  compararCodigo,
};
