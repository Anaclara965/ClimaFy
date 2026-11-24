"use strict";

const rankingModelPadrao = require("../models/rankingModel");
const relatoConsultaModelPadrao = require("../models/relatoConsultaModel");
const { CONHECIMENTO } = require("./chatbotKnowledge");

function criarChatbotService(opcoes = {}) {
  const rankingModel = opcoes.rankingModel || rankingModelPadrao;
  const relatoConsultaModel = opcoes.relatoConsultaModel || relatoConsultaModelPadrao;

  function normalizar(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function detectarIntencao(mensagem) {
    const texto = normalizar(mensagem);
    if (!texto) return "fallback";
    if (/dados pessoais|privacidade|informacoes pessoais|informacoes dos usuarios|protecao.*informacoes|seguranca.*(dados|informacoes)|quem (consegue|pode) ver|outras pessoas.*(ver|acessar).*dados|quem registrou|autor do relato|relato privado/.test(texto)) return "privacidade";
    if (/previsao do tempo|vai chover|tempo amanha|clima amanha|temperatura/.test(texto)) return "limites-tempo";
    if (/invent(e|ar)|fictici|n numeros|estatisticas falsas|dados falsos|sem consultar/.test(texto)) return "limites-dados";
    if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey)\\b/.test(texto)) return "saudacao";
    if (/como criar conta|criar uma conta|fazer cadastro|cadastro/.test(texto)) return "login";
    if (/como fazer login|como entrar|onde faco login|entrar na conta/.test(texto)) return "login";
    if (/onde (fica|encontro|consult|vejo).*ranking|acesso.*ranking|pagina ranking/.test(texto)) return "navegacao-ranking";
    if (/onde (fica|encontro|consult|vejo).*relato|pagina relatos|consultar( os)? relatos|encontrar.*ocorrencia/.test(texto)) return "consulta-relatos";
    if (/onde (registro|cadastro)|onde (comunico|comunicar)|registrar|cadastrar|enviar.*relato|denunciar|novo relato|problema ambiental|formulario/.test(texto) &&
      !/categoria|opcoes|tipos|acompanhar|meus relatos|privacidade|indice|ranking/.test(texto)) return "registro";
    if (/categoria|categorias|tipos de problema|problemas ambientais|ocorrencias?.*(disponive|registr)|opcoes.*(formulario|relato)|qual.*(posso|disponive)/.test(texto)) return "categorias";
    if (/severidade|gravidade/.test(texto)) return "severidade";
    if (/localiza|mapa|ponto.*(ocorrencia|relato)|bairro.*registr/.test(texto)) return "localizacao";
    if (/outro bairro|bairro diferente/.test(texto)) return "outro-bairro";
    if (/meus relatos|acompanh(?:ar|o|e).*relato|andamento.*(meu|do) relato|status.*(meu|do) relato/.test(texto)) return "acompanhamento";
    if (/[0-9a-f]{8}-[0-9a-f-]{27,}/.test(texto) && /relato|ocorrencia/.test(texto)) return "relato-detalhe";
    if (/aberto|em andamento|resolvid|situacao.*relato|diferenca.*(situacao|status).*(modera|relato)/.test(texto)) return "situacoes";
    if (/pendente|rejeitad|solicita.*ajuste|modera|aprovad/.test(texto)) return "moderacao";
    if (/depois.*envio|apos.*enviar|o que acontece.*relato|nao aparece.*public|publicamente/.test(texto)) return "depois-envio";
    if (/relatos? (public|recent|abert|resolvid|em andamento)|alagamentos? (public|recent)|ocorrencia especifica/.test(texto)) return "relatos-dinamicos";
    if (/como.*(calcul|funciona).*indice|formula.*indice|metodologia|peso.*(ocorr|orcamento)/.test(texto)) return "ranking-metodologia";
    if (/o que.*indice|significa.*indice|indice alto|indice baixo|classificacao/.test(texto)) return "ranking-indice";
    if (/primeiro lugar|maior prioridade|qual area.*ranking|ranking.*(pinheiros|area|subprefeitura)/.test(texto)) return "ranking-dinamico";
    if (/ranking|pontuacao|subprefeitura|orcamento/.test(texto)) return "ranking";
    if (/gratuit|quanto custa|paga/.test(texto)) return "gratuito";
    if (/qual regiao|onde.*monitor|cidade.*monitor/.test(texto)) return "regiao";
    if (/objetivo|finalidade|proposito/.test(texto)) return "objetivo";
    if (/o que e.*climafy|objetivo|finalidade|quem pode|gratuit|regiao.*monitor|problemas ambientais|plataforma/.test(texto)) return "plataforma";
    if (/como navegar|navegar|menu|paginas|pagina|usar o site|onde registro|onde consulto/.test(texto)) return "navegacao";
    return "fallback";
  }

  function periodoDoRanking(texto) {
    const mensagem = normalizar(texto);
    if (/\b7\s*d(ias)?\b|sete dias/.test(mensagem)) return "7d";
    if (/\b30\s*d(ias)?\b|trinta dias/.test(mensagem)) return "30d";
    if (/\b90\s*d(ias)?\b|noventa dias/.test(mensagem)) return "90d";
    return "ano";
  }

  function extrairBuscaRanking(texto) {
    const mensagem = normalizar(texto);
    const termos = mensagem.match(/(?:em|da|de)\s+([a-z][a-z0-9 -]{2,40})(?:\?|$)/);
    if (!termos) return "";
    return termos[1].replace(/\b(ranking|posicao|indice|periodo|ano|dias|lugar)\b/g, "").trim();
  }

  function categoriaDosRelatos(texto) {
    const mensagem = normalizar(texto);
    if (/alagamento/.test(mensagem)) return "alagamento";
    if (/queimada/.test(mensagem)) return "queimada";
    if (/calor extremo|calor/.test(mensagem)) return "calor-extremo";
    if (/arvore caida|arvore/.test(mensagem)) return "arvore-caida";
    if (/lixo/.test(mensagem)) return "lixo";
    if (/poluicao.*agua|agua.*poluida/.test(mensagem)) return "poluicao-agua";
    return undefined;
  }

  function statusDosRelatos(texto) {
    const mensagem = normalizar(texto);
    if (/em andamento/.test(mensagem)) return "em_andamento";
    if (/resolvid/.test(mensagem)) return "resolvido";
    if (/abert/.test(mensagem)) return "aberto";
    return undefined;
  }

  async function consultarRanking(mensagem, modo = "resumo") {
    try {
      const dados = await rankingModel.consultar({
        periodo: periodoDoRanking(mensagem),
        busca: extrairBuscaRanking(mensagem),
        ordem: "prioridade",
      });
      if (modo === "metodologia") {
        const metodologia = dados.metodologia;
        if (!metodologia) return "A metodologia publicada do ranking não está disponível para consulta agora.";
        const pesoOcorrencias = Number(metodologia.pesos.ocorrencias).toFixed(2).replace(".", ",");
        const pesoOrcamento = Number(metodologia.pesos.orcamento).toFixed(2).replace(".", ",");
        return `O índice usa a fórmula publicada ${metodologia.versao}: Índice = (ocorrências oficiais normalizadas × ${pesoOcorrencias}) + (déficit relativo do orçamento realizado × ${pesoOrcamento}). ${pesoOcorrencias} corresponde a 65% de peso e ${pesoOrcamento} corresponde a 35% de peso. A referência é ${metodologia.referencia}; o escopo é ${metodologia.escopo}. É um índice comparativo, não um alerta oficial.`;
      }
      if (!dados.ranking.length) return "Não encontrei informações públicas do ranking para essa busca. Consulte os filtros disponíveis na página Ranking.";
      if (modo === "primeiro" || modo === "busca") {
        const item = dados.ranking[0];
        return `${item.nome} está em ${item.posicao}º lugar no ranking, com índice ${item.indice}, classificação ${item.classificacao} e ${item.ocorrencias} ocorrência(s) no período.`;
      }
      const primeiros = dados.ranking.slice(0, 3).map((item) => `${item.posicao}. ${item.nome} (índice ${item.indice})`);
      return `O ranking monitora ${dados.resumo.areasMonitoradas} áreas e soma ${dados.resumo.ocorrencias} ocorrência(s) no período. As primeiras posições são: ${primeiros.join("; ")}. Consulte os dados atuais na página Ranking.`;
    } catch (erro) {
      return modo === "metodologia"
        ? "Não consegui confirmar a metodologia publicada do ranking agora. Não vou inventar uma fórmula."
        : "No momento não consegui consultar o ranking publicado. Não vou inventar posições ou pontuações; tente novamente na página Ranking.";
    }
  }

  async function consultarRelatos(mensagem) {
    try {
      const dados = await relatoConsultaModel.listar({
        pagina: 1,
        limite: 3,
        busca: "",
        categoria: categoriaDosRelatos(mensagem),
        status: statusDosRelatos(mensagem),
        ordem: "recent",
      });
      if (!dados.relatos.length) return "Não encontrei relatos públicos correspondentes aos filtros informados. Os resultados podem mudar conforme a moderação.";
      const itens = dados.relatos.map((relato) => `"${relato.titulo}" em ${relato.bairro}, categoria ${relato.categoria}, situação ${relato.status.replace("_", " ")}`);
      return `Encontrei ${dados.paginacao.total} relato(s) público(s). Os mais recentes são: ${itens.join("; ")}.`;
    } catch (erro) {
      return "Não consegui consultar os relatos públicos agora. Não vou apresentar dados não confirmados; tente novamente na página Relatos.";
    }
  }

  async function consultarRelatoPublico(mensagem) {
    const publicId = normalizar(mensagem).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)?.[0];
    if (!publicId) return CONHECIMENTO.consultaRelatos;
    try {
      const relato = await relatoConsultaModel.buscarPublico(publicId);
      if (!relato) return "Não encontrei esse relato entre os registros públicos.";
      return `O relato "${relato.titulo}" está ${relato.status.replace("_", " ")}. Ele pertence à categoria ${relato.categoria} e está associado ao bairro ${relato.bairro}.`;
    } catch (erro) {
      return "Não consegui consultar esse relato público agora. Tente novamente na página Relatos.";
    }
  }

  async function responder(mensagem) {
    switch (detectarIntencao(mensagem)) {
      case "privacidade": return CONHECIMENTO.privacidade;
      case "limites-tempo": return CONHECIMENTO.limitesTempo;
      case "limites-dados": return CONHECIMENTO.limitesDados;
      case "saudacao": return CONHECIMENTO.saudacao;
      case "login": return CONHECIMENTO.login;
      case "registro": return CONHECIMENTO.registro;
      case "categorias": return CONHECIMENTO.categorias;
      case "severidade": return CONHECIMENTO.severidade;
      case "localizacao": return CONHECIMENTO.localizacao;
      case "outro-bairro": return CONHECIMENTO.outroBairro;
      case "acompanhamento": return CONHECIMENTO.acompanhamento;
      case "moderacao": return CONHECIMENTO.moderacao;
      case "situacoes": return CONHECIMENTO.situacoes;
      case "depois-envio": return CONHECIMENTO.depoisEnvio;
      case "consulta-relatos": return CONHECIMENTO.consultaRelatos;
      case "relatos-dinamicos": return consultarRelatos(mensagem);
      case "relato-detalhe": return consultarRelatoPublico(mensagem);
      case "ranking-metodologia": return consultarRanking(mensagem, "metodologia");
      case "ranking-indice": return CONHECIMENTO.rankingIndice;
      case "ranking-dinamico": return consultarRanking(mensagem, "primeiro");
      case "ranking": return consultarRanking(mensagem);
      case "gratuito": return CONHECIMENTO.gratuito;
      case "regiao": return CONHECIMENTO.regiao;
      case "objetivo": return CONHECIMENTO.objetivo;
      case "navegacao-ranking": return "Acesse a página Ranking para consultar seus filtros de período, busca e ordenação.";
      case "plataforma": return CONHECIMENTO.plataforma;
      case "navegacao": return CONHECIMENTO.navegacao;
      default: return CONHECIMENTO.fallback;
    }
  }

  return { responder, detectarIntencao };
}

module.exports = { criarChatbotService, ...criarChatbotService() };
