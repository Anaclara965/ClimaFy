"use strict";

const chatbot = require("../services/chatbotService");

async function responderMensagem(req, res) {
  const mensagem = req.body?.mensagem;
  if (typeof mensagem !== "string" || !mensagem.trim()) {
    return res.status(422).json({ erro: "Digite uma mensagem." });
  }
  if (mensagem.trim().length > 500) {
    return res.status(422).json({ erro: "A mensagem deve ter no máximo 500 caracteres." });
  }

  const resposta = await chatbot.responder(mensagem.trim());
  return res.json({ resposta });
}

module.exports = { responderMensagem };
