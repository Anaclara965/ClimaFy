(function (global) {
  "use strict";

  function normalizar(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function responder(pergunta, usuarioAdministrativo) {
    const texto = normalizar(pergunta);
    if (!texto) {
      return "Escreva sua dúvida e vou tentar ajudar.";
    }

    const perguntaAdministrativa =
      /\b(admin\w*|painel|dashboard|usuario\w*|investimento\w*|relatorio\w*|exportar|area interna)\b/.test(texto) ||
      (/\b(moderac\w*|moderar)\b/.test(texto) && /\b(acessar|acesso|area)\b/.test(texto));

    if (perguntaAdministrativa && !usuarioAdministrativo) {
      return "Essa área é usada pela equipe do ClimaFy e só aparece para contas autorizadas. Se precisar de acesso, fale com a equipe.";
    }

    if (/\b(perfil|avatar)\b/.test(texto) && /\b(fot\w*|imag\w*|avatar)\b/.test(texto)) {
      return "Entre na sua conta, abra Minha conta e escolha “Escolher foto”. Selecione uma imagem JPEG ou PNG de até 5 MB e toque em “Enviar foto”.";
    }

    const perguntaDePrazo = /\b(quanto tempo|demor\w*|prazo|temp\w*|quando)\b/.test(texto);
    const assuntoDeAprovacao = /\b(relat\w*|aprov\w*|moderac\w*|analise)\b/.test(texto);
    if (perguntaDePrazo && assuntoDeAprovacao) {
      return "A equipe analisa o relato em até 24 horas. Se aprovado, ele aparece junto aos outros na página Relatos. Você pode acompanhar em “Meus relatos”.";
    }

    if (/\b(fot\w*|imag\w*|vid\w*|anex\w*|mid\w*|arquiv\w*)\b/.test(texto)) {
      return "Ao enviar um relato, escolha as fotos ou vídeos que mostram o problema. A tela informa quais arquivos você pode enviar.";
    }

    if (/\b(local\w*|enderec\w*|pont\w*|coordenad\w*|selecionar local)\b/.test(texto)) {
      return "Ao criar um relato, procure o endereço ou toque no local certo do mapa. Você também pode usar sua localização atual. Confira o local antes de enviar.";
    }

    if (/\b(senh\w*|recuper\w*|esquec\w*|redefin\w*)\b/.test(texto)) {
      return "Para mudar sua senha, abra Minha conta e escolha Alterar senha. Se esqueceu a senha, na tela Entrar escolha “Esqueceu sua senha?” e siga as instruções do e-mail.";
    }

    if (/\b(cadastr\w*|criar conta|registrar conta|inscrev\w*)\b/.test(texto)) {
      return "Escolha Criar conta, preencha seus dados e confirme seu e-mail. Depois, siga as etapas para concluir seu cadastro.";
    }

    if (/\b(login|entr\w*|acessar conta|fazer login)\b/.test(texto)) {
      return "Na tela Entrar, informe seu e-mail e senha. Se ainda não tem conta, escolha Criar conta; se esqueceu a senha, toque em “Esqueceu sua senha?”.";
    }

    if (/\b(status|situa\w*|andament\w*|acompanha\w*|atualiza\w*)\b/.test(texto)) {
      return "Entre na sua conta e abra “Meus relatos” para ver as novidades sobre seus envios. Os relatos aprovados também aparecem na página Relatos.";
    }

    if (/\b(map\w*)\b/.test(texto)) {
      return "Ao enviar um relato, use o mapa para marcar onde o problema aconteceu. Depois de aprovado, ele aparece na página Relatos.";
    }

    if (/\b(onde|ver|mostr\w*|buscar|consult\w*|visualiz\w*|publicad\w*)\b/.test(texto)) {
      return "Abra a página Relatos para ver os registros da comunidade. Use a busca para encontrar um relato e toque nele para ver mais detalhes.";
    }

    if (/\b(relat\w*|denunci\w*|alag\w*|enchent\w*|registr\w*|envi\w*|event\w*|problem\w*)\b/.test(texto)) {
      return "Entre na sua conta, escolha Relatar e conte o que aconteceu. Marque o local e envie. A equipe confere o relato antes de ele aparecer na página Relatos.";
    }

    if (/\b(rank\w*|prioridad\w*|subprefeitura|orcament\w*|indice\w*)\b/.test(texto)) {
      return "O ranking compara as subprefeituras usando os problemas registrados e o orçamento já utilizado. Ele ajuda a mostrar quais regiões precisam de mais atenção.";
    }

    if (/\b(moderac\w*|moderador\w*|verific\w*|aprov\w*|rejeit\w*)\b/.test(texto)) {
      return "A equipe confere os relatos antes de mostrá-los na página Relatos. Essa análise pode levar até 24 horas.";
    }

    if (/\b(climafy|plataform\w*|objetiv\w*|funcion\w*|sobre|proposit\w*)\b/.test(texto)) {
      return "O ClimaFy reúne relatos de moradores sobre problemas climáticos e ambientais. Assim, a comunidade pode acompanhar o que acontece nos bairros.";
    }

    if (perguntaAdministrativa && usuarioAdministrativo) {
      return "Na área da equipe, você pode revisar relatos e consultar informações sobre usuários, relatórios e investimentos. As opções dependem do acesso da sua conta.";
    }

    return "Desculpe, ainda não sei responder a isso. Posso ajudar com cadastro, acesso à conta, senha, relatos, fotos, localização, ranking ou situação de um relato.";
  }

  const api = { responder };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.ClimaFyChatbotRespostas = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
