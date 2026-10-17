const test = require("node:test");
const assert = require("node:assert/strict");

const {
  papelSuficiente,
  exigirAutenticacao,
  criarExigirAutenticacao,
  exigirPapel,
} = require("../app/middlewares/exigirAutenticacao");
const { normalizarLista } = require("../app/controllers/preferenciasControllers");

// Resposta falsa: guarda status, corpo e redirecionamento sem subir servidor.
function criarRespostaFalsa() {
  return {
    statusCode: 200,
    corpo: null,
    redirecionamento: null,
    renderizado: null,
    locals: {},
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(corpo) {
      this.corpo = corpo;
      return this;
    },
    redirect(codigo, destino) {
      this.statusCode = codigo;
      this.redirecionamento = destino;
      return this;
    },
    render(view, dados) {
      this.renderizado = { view, dados };
      return this;
    },
  };
}

function criarRequisicao({ sessao = {}, url = "/adm" } = {}) {
  return { session: sessao, originalUrl: url, path: url, ip: "127.0.0.1" };
}

// ---------------------------------------------------------------------------
// Hierarquia de papéis (README 5.4)
// ---------------------------------------------------------------------------
test("administrador herda as permissoes de moderador e cidadao", () => {
  assert.equal(papelSuficiente("administrador", "moderador"), true);
  assert.equal(papelSuficiente("administrador", "cidadao"), true);
  assert.equal(papelSuficiente("moderador", "administrador"), false);
  assert.equal(papelSuficiente("cidadao", "moderador"), false);
  assert.equal(papelSuficiente(undefined, "cidadao"), false);
});

// ---------------------------------------------------------------------------
// exigirAutenticacao
// ---------------------------------------------------------------------------
test("visitor em rota de pagina vai para o login guardando o destino", () => {
  const req = criarRequisicao({ url: "/adm/usuarios" });
  const res = criarRespostaFalsa();
  let chamouNext = false;

  exigirAutenticacao(req, res, () => {
    chamouNext = true;
  });

  assert.equal(chamouNext, false);
  assert.equal(res.statusCode, 303);
  assert.equal(res.redirecionamento, "/login?proximo=%2Fadm%2Fusuarios");
});

test("visitor em rota de API recebe 401 em JSON", () => {
  const req = criarRequisicao({ url: "/api/preferencias" });
  const res = criarRespostaFalsa();

  exigirAutenticacao(req, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.ok(res.corpo.erro);
});

test("usuario logado e ainda ativo no banco segue adiante", async () => {
  const req = criarRequisicao({ sessao: { usuario: { id: 1, papel: "cidadao" } } });
  req.session.assinaturaSenha = require("../app/middlewares/exigirAutenticacao").assinaturaSenha({});
  const res = criarRespostaFalsa();
  let chamouNext = false;

  const verificar = criarExigirAutenticacao({
    buscarPorId: async () => ({
      id: 1, papel: "cidadao", status: "ativo", email_verificado_em: "2026-09-27",
    }),
  });
  await verificar(req, res, () => {
    chamouNext = true;
  });

  assert.equal(chamouNext, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.locals.usuario.id, 1);
});

// ---------------------------------------------------------------------------
// exigirPapel
// ---------------------------------------------------------------------------
test("cidadao nao acessa area administrativa (403)", () => {
  const req = criarRequisicao({ url: "/adm", sessao: { usuario: { id: 1, papel: "cidadao" } } });
  const res = criarRespostaFalsa();

  exigirPapel("administrador")(req, res, () => {
    throw new Error("não deveria passar");
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.renderizado.view, "pages/erro");
});

test("moderador passa no papel mínimo do painel sem virar administrador na hierarquia", () => {
  const sessao = { usuario: { id: 2, papel: "moderador" } };

  const resModeracao = criarRespostaFalsa();
  let liberouModeracao = false;
  exigirPapel("moderador")(criarRequisicao({ sessao, url: "/adm/moderacao" }), resModeracao, () => {
    liberouModeracao = true;
  });
  assert.equal(liberouModeracao, true);

  const resPainel = criarRespostaFalsa();
  let liberouPainel = false;
  exigirPapel("moderador")(criarRequisicao({ sessao, url: "/adm" }), resPainel, () => { liberouPainel = true; });
  assert.equal(liberouPainel, true);
  assert.equal(papelSuficiente("moderador", "administrador"), false);
});

// ---------------------------------------------------------------------------
// normalizarLista: o formulário manda array, mas um item chega como string
// ---------------------------------------------------------------------------
test("normaliza a lista de bairros/categorias recebida do formulario", () => {
  assert.deepEqual(normalizarLista(["1", "2", ""]), ["1", "2"]);
  assert.deepEqual(normalizarLista("7"), ["7"]);
  assert.deepEqual(normalizarLista(undefined), []);
  assert.deepEqual(normalizarLista([3, " 4 "]), ["3", "4"]);
});
