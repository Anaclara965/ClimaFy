// Envio de e-mail (nodemailer). Sem SMTP_HOST configurado o sistema entra em
// MODO DESENVOLVIMENTO: nao envia nada e imprime o codigo no console, o que
// permite testar o fluxo de verificacao sem servidor de e-mail.
//
// O require do nodemailer e feito dentro da funcao de proposito: se a
// dependencia nao estiver instalada, o servidor continua subindo.
const { VALIDADE_MINUTOS } = require("../helpers/codigoVerificacao");

const REMETENTE_PADRAO = process.env.SMTP_FROM || "ClimaFy <guilhermebrito2110@gmail.com>";

async function enviarEmail({ para, assunto, texto, html }) {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === "production") {
      throw Object.assign(new Error("Serviço de e-mail indisponível."), { code: "SMTP_NAO_CONFIGURADO" });
    }
    console.log(
      [
        "",
        "================= EMAIL (modo desenvolvimento) =================",
        `Para:    ${para}`,
        `Assunto: ${assunto}`,
        texto,
        "===============================================================",
        "",
      ].join("\n")
    );
    return { enviado: false, motivo: "smtp-nao-configurado" };
  }

  const nodemailer = require("nodemailer");
  const porta = Number(process.env.SMTP_PORT) || 587;

  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transporte.sendMail({
    from: REMETENTE_PADRAO,
    to: para,
    subject: assunto,
    text: texto,
    html,
  });

  return { enviado: true };
}

function enviarCodigoVerificacao(email, codigo, { finalidade = "cadastro" } = {}) {
  const titulos = {
    cadastro: "Confirme seu cadastro no ClimaFy",
    recuperacao_senha: "Recupere sua senha do ClimaFy",
    alteracao_email: "Confirme seu novo e-mail no ClimaFy",
  };
  const assunto = titulos[finalidade] ?? "ClimaFy - código de verificação";

  const texto = [
    `Seu código de verificação ClimaFy é: ${codigo}`,
    "",
    `Ele expira em ${VALIDADE_MINUTOS} minutos e pode ser usado uma única vez.`,
    "Se você não pediu este código, ignore esta mensagem.",
  ].join("\n");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px">
      <h2 style="margin:0 0 12px">ClimaFy</h2>
      <p>Seu código de verificação é:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${codigo}</p>
      <p>Ele expira em ${VALIDADE_MINUTOS} minutos e pode ser usado uma única vez.</p>
    </div>`;

  return enviarEmail({ para: email, assunto, texto, html });
}

module.exports = { enviarEmail, enviarCodigoVerificacao };
