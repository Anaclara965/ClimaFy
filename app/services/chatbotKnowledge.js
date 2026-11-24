"use strict";

const CATEGORIAS = [
  "alagamento",
  "queimada",
  "calor extremo",
  "árvore caída",
  "lixo",
  "poluição da água",
];

const CONHECIMENTO = Object.freeze({
  plataforma: "O ClimaFy é uma plataforma comunitária de monitoramento climático e ambiental em São Paulo. Pessoas com uma conta podem registrar ocorrências, enquanto qualquer visitante pode consultar os relatos públicos e o ranking.",
  objetivo: "O objetivo do ClimaFy é organizar relatos da comunidade e dados públicos para facilitar o acompanhamento de problemas climáticos e ambientais.",
  gratuito: "O acesso e o cadastro no ClimaFy são gratuitos. Algumas ações, como registrar um relato e acompanhar seus próprios relatos, exigem uma conta autenticada.",
  regiao: "O ClimaFy monitora ocorrências e dados da cidade de São Paulo, organizados por bairro e subprefeitura.",
  categorias: `As categorias disponíveis são: ${CATEGORIAS.join(", ")}.`,
  registro: "Para registrar uma ocorrência, entre na sua conta e selecione Registrar um Evento no menu. Preencha título, descrição, categoria, severidade, bairro e localização no mapa. O relato começa como aberto e passa por moderação antes de aparecer publicamente.",
  severidade: "Severidade indica a gravidade informada para o evento: leve, moderada, grave ou crítica. Escolha a opção que melhor representa o risco descrito.",
  categoriaIndefinida: "Escolha a categoria que melhor descreve o problema principal. Se ainda estiver em dúvida, descreva o evento com clareza e selecione a opção mais próxima; as categorias disponíveis são alagamento, queimada, calor extremo, árvore caída, lixo e poluição da água.",
  localizacao: "No formulário de novo relato, informe o bairro e selecione o ponto correspondente no mapa. A localização precisa ser válida para o envio.",
  outroBairro: "Sim. Você pode registrar uma ocorrência em outro bairro, desde que selecione o bairro correto e a localização correspondente no formulário.",
  consultaRelatos: "Para consultar ou encontrar uma ocorrência pública, acesse a página Relatos. Ela permite buscar e filtrar por situação, categoria, bairro, período e ordem.",
  acompanhamento: "Acompanhe seus próprios relatos na página Meus relatos depois de entrar na conta. Não consulto informações privadas nem exponho dados de outros usuários.",
  situacoes: "A situação do relato descreve o problema: aberto, em andamento ou resolvido. Ela é diferente da moderação, que controla se a versão do conteúdo está pendente, aprovada, rejeitada ou aguardando ajuste.",
  depoisEnvio: "Depois do envio, o relato fica aberto e aguarda moderação. Uma aprovação permite sua publicação; rejeição ou solicitação de ajuste pode ser acompanhada na página Meus relatos. A situação do problema continua sendo um campo separado.",
  naoPublicado: "Um relato pode ainda não aparecer na página Relatos porque a versão atual está aguardando moderação, foi rejeitada, recebeu solicitação de ajuste ou foi excluída. Confira a situação privada na página Meus relatos.",
  pendente: "Pendente significa que a versão atual ainda não recebeu uma decisão de moderação.",
  rejeitado: "Quando um relato é rejeitado, ele não aparece nos relatos públicos. A decisão e o motivo ficam disponíveis ao próprio autor na página Meus relatos.",
  ajuste: "Solicitação de ajuste significa que o moderador pediu uma correção no conteúdo. O autor pode editar o relato na página Meus relatos; a nova versão volta para moderação.",
  privacidade: "O ClimaFy não divulga dados pessoais de quem registrou uma ocorrência pelo chatbot. Relatos privados só podem ser consultados pelo próprio autor, com autenticação, ou por perfis autorizados de moderação.",
  ranking: "O ranking compara as subprefeituras de São Paulo usando ocorrências oficiais de alagamento e orçamento realizado. Consulte os resultados atuais na página Ranking.",
  rankingAreas: "O ranking mostra as subprefeituras com dados publicados para o período selecionado. Os resultados atuais e os filtros de 7, 30, 90 dias ou ano estão na página Ranking.",
  rankingIndice: "O índice é comparativo: um valor alto indica maior prioridade relativa dentro do conjunto analisado; um valor baixo indica menor prioridade relativa. Ele não é uma previsão nem um alerta oficial.",
  navegacao: "Use o cabeçalho ou o menu inferior para acessar Início, Relatos, Ranking e Sobre. Para registrar uma ocorrência, selecione Registrar um Evento no menu. Para acompanhar seus relatos, acesse a página Meus relatos.",
  login: "Para entrar, selecione a opção Entrar. Para criar uma conta, selecione Criar conta.",
  limitesTempo: "Não há integração meteorológica disponível no ClimaFy. Por isso, não consigo informar previsão do tempo ou dizer se vai chover amanhã.",
  limitesDados: "Só posso informar dados existentes nas funcionalidades públicas do ClimaFy. Não invento estatísticas, posições, índices ou informações que não estejam disponíveis no sistema.",
  saudacao: "Olá! Posso ajudar com a plataforma, registro de ocorrências, categorias, relatos públicos, moderação, privacidade, navegação e ranking.",
  fallback: "Não consegui identificar a dúvida. Posso ajudar com registro, categorias, relatos públicos, acompanhamento dos seus relatos, moderação, privacidade, navegação ou ranking.",
});

module.exports = { CATEGORIAS, CONHECIMENTO };
