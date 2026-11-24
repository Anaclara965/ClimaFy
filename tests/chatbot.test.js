const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { criarChatbotService } = require("../app/services/chatbotService");
const { CONHECIMENTO, CATEGORIAS } = require("../app/services/chatbotKnowledge");
const { responderMensagem } = require("../app/controllers/chatbotControllers");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function respostaJson() {
  let corpo;
  return {
    res: {
      status(codigo) {
        this.statusCode = codigo;
        return this;
      },
      json(valor) {
        corpo = valor;
        return valor;
      },
    },
    corpo() {
      return corpo;
    },
  };
}

test("chatbot identifica informações públicas e não expõe relatos privados", async () => {
  let filtroRanking;
  let filtroRelatos;
  const service = criarChatbotService({
    rankingModel: {
      async consultar(filtros) {
        filtroRanking = filtros;
        return {
          ranking: [
            { nome: "Pinheiros", posicao: 1, ocorrencias: 4, indice: 82, classificacao: "Crítica" },
          ],
          resumo: { ocorrencias: 10, areasMonitoradas: 32, areasComOcorrencias: 8 },
        };
      },
    },
    relatoConsultaModel: {
      async listar(filtros) {
        filtroRelatos = filtros;
        return {
          relatos: [
            { titulo: "Alagamento na rua", bairro: "Pinheiros", categoria: "Alagamento", status: "aberto" },
          ],
          paginacao: { total: 1 },
        };
      },
    },
  });

  assert.equal(service.detectarIntencao("Qual é a posição do ranking?"), "ranking");
  const ranking = await service.responder("Como está o ranking em Pinheiros?");
  assert.match(ranking, /Pinheiros/);
  assert.equal(filtroRanking.ordem, "prioridade");

  const relatos = await service.responder("Quais alagamentos públicos existem?");
  assert.match(relatos, /Alagamento na rua/);
  assert.equal(filtroRelatos.categoria, "alagamento");

  const privados = await service.responder("Consulte meus relatos privados");
  assert.match(privados, /não consulto informações privadas/i);
});

test("chatbot usa respostas predefinidas para registro e categorias", async () => {
  const service = criarChatbotService({
    rankingModel: { async consultar() { throw new Error("não usado"); } },
    relatoConsultaModel: { async listar() { throw new Error("não usado"); } },
  });

  const resposta = await service.responder("Como registrar uma queimada?");
  assert.match(resposta, /Registrar um Evento/);
  assert.doesNotMatch(resposta, /\/new-report/);
  assert.doesNotMatch(resposta, /categorias incluem|alagamento|queimada|poluição da água/i);
  assert.match(await service.responder("Qual é a situação em andamento?"), /aberto/);
});

test("chatbot separa intenções parecidas e reconhece variações de linguagem", () => {
  const service = criarChatbotService();

  assert.equal(service.detectarIntencao("Quero denunciar um alagamento"), "registro");
  assert.equal(service.detectarIntencao("Que tipos de problemas posso registrar?"), "categorias");
  assert.equal(service.detectarIntencao("Quais problemas ambientais podem ser registrados?"), "categorias");
  assert.equal(service.detectarIntencao("Como acompanho o relato que enviei?"), "acompanhamento");
  assert.equal(service.detectarIntencao("Quem pode ver os dados de quem registrou?"), "privacidade");
  assert.equal(service.detectarIntencao("Qual a diferença entre situação e moderação?"), "situacoes");
  assert.equal(service.detectarIntencao("Como é calculado o índice do ranking?"), "ranking-metodologia");
  assert.equal(service.detectarIntencao("O que significa um índice alto?"), "ranking-indice");
  assert.equal(service.detectarIntencao("Qual área está em primeiro lugar?"), "ranking-dinamico");
  assert.equal(service.detectarIntencao("Vai chover amanhã?"), "limites-tempo");
  assert.equal(service.detectarIntencao("Pode inventar números para mim?"), "limites-dados");
  assert.equal(service.detectarIntencao("Não entendi esta pergunta"), "fallback");
});

test("chatbot apresenta nomes amigáveis em vez de rotas técnicas", async () => {
  const service = criarChatbotService();
  const perguntas = [
    "Como registrar uma ocorrência?",
    "Onde vejo os relatos públicos?",
    "Como acompanho meus relatos?",
    "Onde fica o ranking?",
    "Como entrar na conta?",
  ];

  for (const pergunta of perguntas) {
    const resposta = await service.responder(pergunta);
    assert.doesNotMatch(resposta, /\/(?:new-report|meus-relatos|relatos|ranking|login|cadastro-dados-pessoais)(?:[)\s]|$)/);
  }

  assert.match(await service.responder("Como registrar uma ocorrência?"), /Registrar um Evento/);
  assert.match(await service.responder("Onde vejo os relatos públicos?"), /página Relatos/);
  assert.match(await service.responder("Como acompanho meus relatos?"), /Meus relatos/);
  assert.match(await service.responder("Como entrar na conta?"), /Entrar|Criar conta/);
});

test("chatbot mantém registro, categorias e privacidade em intenções isoladas", async () => {
  const service = criarChatbotService();
  const casos = [
    {
      pergunta: "Como registrar uma ocorrência?",
      intencao: "registro",
      respostaEsperada: /Registrar um Evento/,
      respostaIndevida: /categorias incluem|alagamento|queimada|poluição da água/i,
    },
    {
      pergunta: "Estou preenchendo o formulário. Quais opções de categoria aparecem?",
      intencao: "categorias",
      respostaEsperada: /alagamento.*queimada.*calor extremo.*árvore caída.*lixo.*poluição da água/i,
      respostaIndevida: /\/new-report|moderação|dados pessoais/i,
    },
    {
      pergunta: "Como funciona a proteção das informações dos usuários?",
      intencao: "privacidade",
      respostaEsperada: /não divulga dados pessoais|relatos privados/i,
      respostaIndevida: /\/new-report|categorias disponíveis|ranking/i,
    },
  ];

  for (const caso of casos) {
    assert.equal(service.detectarIntencao(caso.pergunta), caso.intencao);
    const resposta = await service.responder(caso.pergunta);
    assert.match(resposta, caso.respostaEsperada);
    assert.doesNotMatch(resposta, caso.respostaIndevida);
  }
});

test("chatbot responde às perguntas principais sem repetir ou misturar blocos", async () => {
  const service = criarChatbotService();
  const casos = [
    {
      pergunta: "Quero comunicar um problema ambiental. Onde faço isso?",
      intencao: "registro",
      respostaEsperada: /Registrar um Evento/,
      respostaIndevida: /As categorias disponíveis|alagamento|queimada|poluição da água/i,
    },
    {
      pergunta: "Que tipos de problemas posso registrar?",
      intencao: "categorias",
      respostaEsperada: /As categorias disponíveis/,
      respostaIndevida: /\/new-report|entre na sua conta|preencha título/i,
    },
    {
      pergunta: "Se eu enviar um relato, outras pessoas conseguem ver meus dados?",
      intencao: "privacidade",
      respostaEsperada: /não divulga dados pessoais|relatos privados/i,
      respostaIndevida: /\/new-report|As categorias disponíveis|preencha título/i,
    },
  ];

  for (const caso of casos) {
    assert.equal(service.detectarIntencao(caso.pergunta), caso.intencao);
    const resposta = await service.responder(caso.pergunta);
    assert.match(resposta, caso.respostaEsperada);
    assert.doesNotMatch(resposta, caso.respostaIndevida);
    assert.equal(new Set(resposta.split(". ").filter(Boolean)).size, resposta.split(". ").filter(Boolean).length);
  }
});

test("resposta de cadastro permanece consistente no serviço, API e frontend", async () => {
  const pergunta = "Quero comunicar um problema ambiental. Onde faço isso?";
  const service = criarChatbotService();
  const direta = await service.responder(pergunta);
  const api = respostaJson();

  await responderMensagem({ body: { mensagem: pergunta } }, api.res);

  assert.equal(service.detectarIntencao(pergunta), "registro");
  assert.equal(CONHECIMENTO.registro, direta);
  assert.equal(api.corpo().resposta, direta);
  assert.doesNotMatch(direta, /As categorias disponíveis|alagamento|queimada|calor extremo|árvore caída|lixo|poluição da água/i);

  const script = read("app/public/js/chatbot.js");
  assert.doesNotMatch(script, /As categorias disponíveis|CATEGORIAS|categoriaIndefinida/);
  assert.equal((script.match(/addMessage\("assistant", resposta\)/g) || []).length, 1);
  assert.deepEqual(CATEGORIAS, [
    "alagamento",
    "queimada",
    "calor extremo",
    "árvore caída",
    "lixo",
    "poluição da água",
  ]);
});

test("chatbot reconhece variações sem misturar as três intenções", async () => {
  const service = criarChatbotService();
  const variacoes = [
    ["Quero enviar um relato, como faço?", "registro"],
    ["Onde comunico uma ocorrência ambiental?", "registro"],
    ["Que tipos de problemas ambientais posso cadastrar?", "categorias"],
    ["Quais ocorrências estão disponíveis para registro?", "categorias"],
    ["Quem pode ver os dados de quem registrou?", "privacidade"],
    ["Outras pessoas conseguem acessar meus dados se eu relatar?", "privacidade"],
  ];

  for (const [pergunta, intencao] of variacoes) {
    assert.equal(service.detectarIntencao(pergunta), intencao);
  }
});

test("chatbot consulta metodologia e ranking atual sem inventar dados", async () => {
  let filtros;
  const service = criarChatbotService({
    rankingModel: {
      async consultar(opcoes) {
        filtros = opcoes;
        return {
          ranking: [{ nome: "Pinheiros", posicao: 1, ocorrencias: 4, indice: 82, classificacao: "Crítica" }],
          resumo: { areasMonitoradas: 32, ocorrencias: 10 },
          metodologia: {
            versao: "65-35-v1",
            pesos: { ocorrencias: 0.65, orcamento: 0.35 },
            referencia: "2026-06-26",
            escopo: "alagamentos dos CSVs locais e orçamento anual por subprefeitura; não inclui relatos dos usuários",
          },
        };
      },
    },
  });

  const metodologia = await service.responder("Como é calculado o índice?");
  assert.match(metodologia, /Índice = \(ocorrências oficiais normalizadas × 0,65\) \+ \(déficit relativo do orçamento realizado × 0,35\)/);
  assert.match(metodologia, /65%/);
  assert.match(metodologia, /35%/);
  assert.doesNotMatch(metodologia, /0\.65%|0\.35%/);
  assert.match(metodologia, /2026-06-26/);
  assert.match(metodologia, /não inclui relatos dos usuários/);
  assert.match(metodologia, /comparativo/i);

  const primeiro = await service.responder("Qual área está em primeiro lugar?");
  assert.match(primeiro, /Pinheiros/);
  assert.equal(filtros.ordem, "prioridade");
});

test("chatbot consulta a situação somente de um relato público identificado", async () => {
  const service = criarChatbotService({
    relatoConsultaModel: {
      async buscarPublico(publicId) {
        assert.equal(publicId, "12345678-1234-1234-1234-123456789abc");
        return { titulo: "Rua alagada", status: "em_andamento", categoria: "Alagamento", bairro: "Pinheiros" };
      },
    },
  });

  const resposta = await service.responder("Qual a situação do relato 12345678-1234-1234-1234-123456789abc?");
  assert.match(resposta, /em andamento/);
  assert.match(resposta, /Pinheiros/);
});

test("chatbot é integrado ao partial público e tem API própria", () => {
  const header = read("app/views/partials/header.ejs");
  const partial = read("app/views/partials/chatbot.ejs");
  const css = read("app/public/css/chatbot.css");
  const script = read("app/public/js/chatbot.js");
  const mascot = read("app/public/images/chatbot-mascot.svg");
  const router = read("app/routes/router.js");

  assert.match(header, /include\('\.\/chatbot'\)/);
  assert.doesNotMatch(partial, /meus-relatos|api\/meus-relatos/);
  assert.match(partial, /aria-controls="chatbot-window"/);
  assert.match(partial, /aria-expanded="false"/);
  assert.match(partial, /role="dialog"/);
  assert.match(partial, /role="log"/);
  assert.match(partial, /chatbot-mascot\.svg/);
  assert.match(css, /@media \(max-width: 767\.98px\)/);
  assert.match(css, /@media \(max-height:/);
  assert.match(css, /--chatbot-header-bottom/);
  assert.match(css, /--chatbot-viewport-height/);
  assert.match(css, /grid-template-rows:\s*auto minmax\(0, 1fr\) auto auto/);
  assert.match(css, /padding-bottom:\s*calc\(0\.65rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\.chatbot-trigger\.is-open\s*\{[\s\S]*display:\s*none/);
  assert.match(script, /sessionStorage/);
  assert.match(script, /trigger\.classList\.add\("is-open"\)/);
  assert.match(script, /trigger\.classList\.remove\("is-open"\)/);
  assert.match(script, /Escape/);
  assert.match(script, /textContent/);
  assert.match(script, /visualViewport/);
  assert.match(script, /chatbot-avatar/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(script, /\/api\/chatbot\/mensagem/);
  assert.match(mascot, /<svg/);
  assert.match(mascot, /#147a43/);
  assert.match(router, /router\.post\("\/api\/chatbot\/mensagem"/);
});
