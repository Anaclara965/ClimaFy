// Coordena codigo no banco e entrega por e-mail. SMTP nao participa da transacao
// MySQL: uma falha de entrega nao deve apagar a conta nem fingir envio confirmado.
const verificacaoModel = require("../models/verificacaoModel");
const emailService = require("./emailService");
const { gerarCodigo, hashCodigo, calcularExpiracao } = require("../helpers/codigoVerificacao");

async function emitirCodigoCadastro({ usuarioId, email }) {
  const codigo = gerarCodigo();
  const expiraEm = calcularExpiracao();
  // Falha do banco continua sendo erro real: nao a mascara como falha de SMTP.
  await verificacaoModel.criarCodigo({ usuarioId, codigoHash: hashCodigo(codigo),
    finalidade: "cadastro", expiraEm });
  try {
    const envio = await emailService.enviarCodigoVerificacao(email, codigo, { finalidade: "cadastro" });
    if (envio?.enviado === true) return { enviado: true, expiraEm };
  } catch {
    // Nao registrar objeto/credenciais SMTP nem o codigo de verificacao nos logs.
    console.warn("[verificacao] Nao foi possivel confirmar a entrega do e-mail.");
  }
  return { enviado: false, expiraEm };
}

module.exports = { emitirCodigoCadastro };
