const { BrevoClient } = require("@getbrevo/brevo");
const { VALIDADE_MINUTOS } = require("../helpers/codigoVerificacao");

function obterConfiguracao() {
  const configuracao = {
    apiKey: process.env.BREVO_API_KEY?.trim(),
    email: process.env.BREVO_SENDER_EMAIL?.trim(),
    nome: process.env.BREVO_SENDER_NAME?.trim(),
  };
  const ausentes = Object.entries({
    BREVO_API_KEY: configuracao.apiKey,
    BREVO_SENDER_EMAIL: configuracao.email,
    BREVO_SENDER_NAME: configuracao.nome,
  }).filter(([, valor]) => !valor).map(([nome]) => nome);

  if (ausentes.length) {
    console.error(`[email] Configuração do Brevo incompleta. Variáveis ausentes: ${ausentes.join(", ")}.`);
    throw Object.assign(new Error("Serviço de e-mail indisponível."), { code: "BREVO_CONFIG_INCOMPLETA" });
  }

  return configuracao;
}

function descreverFalha(erro) {
  const status = Number.isInteger(erro?.statusCode) ? erro.statusCode : null;
  const detalheApi = [erro?.body?.message, erro?.body?.code]
    .filter(valor => typeof valor === "string")
    .join(" ")
    .toLowerCase();
  if (status === 401) return "chave de API inválida";
  if (status === 403) return "remetente não autorizado ou não verificado";
  if (status === 400 || status === 422) {
    if (detalheApi.includes("sender")) return "remetente não autorizado ou não verificado";
    if (detalheApi.includes("recipient") || detalheApi.includes("email")) return "destinatário inválido";
    return "destinatário ou mensagem inválida";
  }
  if (status === 429) return "limite de requisições atingido";
  if (status >= 500 || status === 408) return "falha temporária no serviço";
  if (status) return `erro HTTP ${status}`;
  if (erro?.name === "BrevoTimeoutError") return "tempo limite excedido";
  return "falha de comunicação";
}

async function enviarEmail({ para, assunto, texto, html }) {
  const configuracao = obterConfiguracao();
  const cliente = new BrevoClient({
    apiKey: configuracao.apiKey,
    timeoutInSeconds: 20,
    maxRetries: 1,
  });
  const mensagem = {
    sender: { email: configuracao.email, name: configuracao.nome },
    to: [{ email: para }],
    subject: assunto,
    ...(typeof texto === "string" ? { textContent: texto } : {}),
    ...(typeof html === "string" ? { htmlContent: html } : {}),
  };

  try {
    const resultado = await cliente.transactionalEmails.sendTransacEmail(mensagem);
    return {
      enviado: true,
      ...(typeof resultado?.messageId === "string" ? { messageId: resultado.messageId } : {}),
    };
  } catch (erro) {
    const status = Number.isInteger(erro?.statusCode) ? ` (HTTP ${erro.statusCode})` : "";
    console.error(`[email] Falha no envio pelo Brevo${status}: ${descreverFalha(erro)}.`);
    throw Object.assign(new Error("Não foi possível enviar o e-mail."), { code: "BREVO_ENVIO_FALHOU" });
  }
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
