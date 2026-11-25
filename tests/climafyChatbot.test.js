const test = require("node:test");
const assert = require("node:assert/strict");
const { responder } = require("../app/public/js/climafy-chatbot-respostas");

test("responde a perguntas variadas sobre relatos, senha, anexos e ranking", () => {
  assert.match(responder("Como faço para denunciar um alagamento?"), /Relatar/);
  assert.match(responder("Onde vejo os relatos?"), /página Relatos/);
  assert.match(responder("Como altero minha senha?"), /Alterar senha/);
  assert.match(responder("Como envio uma foto?"), /fotos ou vídeos/);
  assert.match(responder("Pra que serve o ranking?"), /subprefeituras/);
  assert.match(responder("Onde seleciono o local do evento?"), /mapa/);
  assert.match(responder("Como funciona a moderação?"), /24 horas/);
  assert.match(responder("Como funciona o mapa?"), /página Relatos/);
  const respostaFoto = responder("Como troco minha foto de perfil?");
  assert.match(respostaFoto, /Escolher foto/);
  assert.doesNotMatch(respostaFoto, /\/alterar-perfil/);
  const respostaAprovacao = responder("Quanto tempo até que um relato seja aprovado?");
  assert.match(respostaAprovacao, /até 24 horas/);
  assert.match(respostaAprovacao, /página Relatos/);
  assert.doesNotMatch(respostaAprovacao, /mapa/);
});

test("não inventa resposta para assunto desconhecido", () => {
  assert.match(responder("Qual será o tempo amanhã?"), /não sei responder/);
});

test("limita detalhes administrativos a perfis autorizados", () => {
  const respostaVisitante = responder("Como acesso o painel administrativo?", false);
  assert.match(respostaVisitante, /equipe do ClimaFy/);
  assert.doesNotMatch(respostaVisitante, /\/adm/);
  assert.match(responder("Como acesso o painel administrativo?", true), /área da equipe/);
});

test("mantém as orientações sem mostrar caminhos técnicos", () => {
  const perguntas = [
    "Como faço para denunciar um alagamento?",
    "Onde vejo os relatos?",
    "Como altero minha senha?",
    "Como envio uma foto?",
    "Pra que serve o ranking?",
    "Como funciona o mapa?",
    "Como troco minha foto de perfil?",
    "Quanto tempo até que um relato seja aprovado?",
    "Como acesso o painel administrativo?",
  ];
  for (const pergunta of perguntas) {
    assert.doesNotMatch(responder(pergunta, true), /\(\/[^)]+\)/);
  }
});
