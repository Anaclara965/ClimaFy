const test = require("node:test");
const assert = require("node:assert/strict");
const {
  criarExigirAutenticacao,
  assinaturaSenha,
  iniciarSessaoAutenticada,
  encerrarSessao,
  exigirPapel,
} = require("../app/middlewares/exigirAutenticacao");
const { destinoSeguro } = require("../app/controllers/controllers");

const usuarioAtivo = {
  id: 1, nome: "Mariana", email: "mariana@example.com", public_id: "teste",
  papel: "cidadao", status: "ativo", email_verificado_em: "2026-09-27",
  senha_hash: "nao-deve-entrar-na-sessao",
};

function respostaFalsa() {
  return {
    locals: {},
    status(codigo) { this.statusCode = codigo; return this; },
    json(corpo) { this.corpo = corpo; return this; },
    redirect(codigo, destino) { this.statusCode = codigo; this.destino = destino; },
    render(view, dados) { this.view = view; this.dados = dados; },
    clearCookie(nome) { this.cookieLimpo = nome; },
  };
}

function requisicaoFalsa() {
  const req = { originalUrl: "/api/preferencias", path: "/api/preferencias" };
  req.session = {
    usuario: { id: 1, papel: "administrador" },
    assinaturaSenha: assinaturaSenha(usuarioAtivo),
    destroy(callback) { delete req.session; callback(); },
  };
  return req;
}

for (const [nome, usuario] of [
  ["bloqueado", { ...usuarioAtivo, status: "bloqueado" }],
  ["inativo", { ...usuarioAtivo, status: "inativo" }],
  ["excluido", null],
  ["sem email verificado", { ...usuarioAtivo, email_verificado_em: null }],
]) {
  test(`revoga a sessao de usuario ${nome} antes de liberar a API`, async () => {
    const req = requisicaoFalsa();
    const res = respostaFalsa();
    await criarExigirAutenticacao({ buscarPorId: async () => usuario })(req, res, () => {
      assert.fail("Nao pode liberar a rota nem falhar silenciosamente");
    });
    assert.equal(res.statusCode, 401);
    assert.equal(req.session, undefined);
    assert.equal(res.locals.usuario, null);
    assert.equal(res.cookieLimpo, "climafy.sid");
  });
}

test("conta bloqueada numa pagina volta ao login sem loop de sessao antiga", async () => {
  const req = requisicaoFalsa();
  req.originalUrl = req.path = "/adm";
  const res = respostaFalsa();
  await criarExigirAutenticacao({ buscarPorId: async () => null })(req, res, assert.fail);
  assert.equal(res.statusCode, 303);
  assert.equal(res.destino, "/login?proximo=%2Fadm");
  assert.equal(req.session, undefined);
});

test("papel rebaixado no banco remove o acesso administrativo na mesma requisicao", async () => {
  const req = requisicaoFalsa();
  const res = respostaFalsa();
  let consultas = 0;
  await criarExigirAutenticacao({ buscarPorId: async (id) => {
    assert.equal(id, 1);
    consultas++;
    return usuarioAtivo;
  } })(req, res, (erro) => {
    assert.ifError(erro);
    exigirPapel("administrador")(req, res, assert.fail);
  });
  assert.equal(res.statusCode, 403);
  assert.equal(consultas, 1);
  assert.equal(req.session.usuario.papel, "cidadao");
  assert.equal(res.locals.usuario.nome, "Mariana");
  assert.equal(req.session.usuario.senha_hash, undefined);
});

test("falha do banco vai ao handler de erro, nunca libera com o papel antigo", async () => {
  const falha = new Error("Banco indisponivel (simulado)");
  let encaminhado;
  await criarExigirAutenticacao({ buscarPorId: async () => { throw falha; } })(
    requisicaoFalsa(), respostaFalsa(), (erro) => { encaminhado = erro; }
  );
  assert.equal(encaminhado, falha);
});

test("trocar o hash da senha revoga a sessao anterior na proxima rota privada", async () => {
  const req = requisicaoFalsa();
  const res = respostaFalsa();
  await criarExigirAutenticacao({ buscarPorId: async () => ({ ...usuarioAtivo, senha_hash: "novo-hash" }) })(
    req, res, assert.fail
  );
  assert.equal(res.statusCode, 401);
  assert.equal(req.session, undefined);
});

test("sessao legada sem assinatura deve fazer login novamente", async () => {
  const req = requisicaoFalsa(); delete req.session.assinaturaSenha;
  const res = respostaFalsa();
  await criarExigirAutenticacao({ buscarPorId: async () => usuarioAtivo })(req, res, assert.fail);
  assert.equal(res.statusCode, 401);
});

test("login renova e salva a sessao preservando so o bairro sugerido", async () => {
  const eventos = [];
  const req = { session: {
    bairroSugerido: 3,
    cadastroPendente: { usuarioId: 1 },
    usuario: { id: 99, papel: "administrador" },
    regenerate(callback) {
      eventos.push("renovar");
      req.session = { save(cb) { eventos.push("salvar"); cb(); } };
      callback();
    },
  } };
  await iniciarSessaoAutenticada(req, usuarioAtivo);
  assert.deepEqual(eventos, ["renovar", "salvar"]);
  assert.equal(req.session.usuario.id, 1);
  assert.equal(req.session.usuario.senha_hash, undefined);
  assert.equal(req.session.bairroSugerido, 3);
  assert.equal(req.session.assinaturaSenha, assinaturaSenha(usuarioAtivo));
  assert.equal(req.session.cadastroPendente, undefined);
});

test("falha ao renovar a sessao interrompe o login", async () => {
  const falha = new Error("Falha simulada ao renovar");
  const req = { session: { regenerate(callback) { callback(falha); } } };
  await assert.rejects(iniciarSessaoAutenticada(req, usuarioAtivo), falha);
  assert.equal(req.session.usuario, undefined);
});

test("falha ao salvar o login destroi a nova sessao", async () => {
  const falha = new Error("Falha simulada ao salvar");
  const req = { session: { regenerate(callback) {
    req.session = {
      save(cb) { cb(falha); },
      destroy(cb) { delete req.session; cb(); },
    };
    callback();
  } } };
  await assert.rejects(iniciarSessaoAutenticada(req, usuarioAtivo), falha);
  assert.equal(req.session, undefined);
});

test("erro ao destruir a sessao nao e ocultado", async () => {
  const falha = new Error("Falha simulada ao destruir");
  await assert.rejects(encerrarSessao({ session: { destroy(cb) { cb(falha); } } }), falha);
});

test("destino de login aceita apenas caminho interno sem controles ou barras invertidas", () => {
  for (const entrada of [undefined, [], "https://example.com", "//example.com", "/\\example.com", "/\t/example.com", "/\r\nLocal: externo"]) {
    assert.equal(destinoSeguro(entrada), null);
  }
  assert.equal(destinoSeguro("/adm/moderacao"), "/adm/moderacao");
  assert.equal(destinoSeguro("/relatos?busca=bras#lista"), "/relatos?busca=bras#lista");
});
