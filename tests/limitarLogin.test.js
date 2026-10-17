const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const { criarLimiteLogin } = require("../app/middlewares/limitarLogin");

function executar(limitar, { ip = "127.0.0.1", email = "teste@example.com", body } = {}) {
  const res = {
    statusCode: 200, headers: {}, passou: false,
    set(nome, valor) { this.headers[nome] = valor; return this; },
    status(codigo) { this.statusCode = codigo; return this; },
    render(view, dados) { this.view = view; this.dados = dados; return this; },
  };
  limitar({ ip, body: body ?? { email } }, res, () => { res.passou = true; });
  return res;
}

test("permite o limite exato por IP e recusa o próximo pedido", () => {
  const limitar = criarLimiteLogin({ limitePorIp: 2, limitePorConta: 10 });
  assert.equal(executar(limitar).passou, true);
  assert.equal(executar(limitar).passou, true);
  const bloqueio = executar(limitar, { email: "outro@example.com" });
  assert.equal(bloqueio.statusCode, 429);
  assert.equal(bloqueio.passou, false);
});

test("limite global por e-mail continua valendo ao trocar o IP", () => {
  const limitar = criarLimiteLogin({ limitePorConta: 2 });
  assert.equal(executar(limitar, { ip: "1" }).passou, true);
  assert.equal(executar(limitar, { ip: "2" }).passou, true);
  assert.equal(executar(limitar, { ip: "3" }).statusCode, 429);
  assert.equal(executar(limitar, { ip: "3", email: "outro@example.com" }).passou, true);
});

test("maiúsculas e espaços não criam novo limite por e-mail", () => {
  const limitar = criarLimiteLogin({ limitePorConta: 1 });
  executar(limitar);
  assert.equal(executar(limitar, { email: "  TESTE@EXAMPLE.COM  " }).statusCode, 429);
});

test("bloqueio não estende a janela e libera no instante da expiração", () => {
  let tempo = 0;
  const limitar = criarLimiteLogin({ limitePorIp: 1, janelaMs: 3000, agora: () => tempo });
  executar(limitar);
  tempo = 1001;
  assert.equal(executar(limitar).headers["Retry-After"], "2");
  tempo = 2999;
  assert.equal(executar(limitar).headers["Retry-After"], "1");
  tempo = 3000;
  assert.equal(executar(limitar).passou, true);
});

test("janelas de IP e conta expiram separadamente", () => {
  let tempo = 0;
  const limitar = criarLimiteLogin({ limitePorConta: 1, janelaMs: 3000, agora: () => tempo });
  executar(limitar, { ip: "1", email: "primeiro@example.com" });
  tempo = 2000;
  executar(limitar, { ip: "1" });
  tempo = 3000;
  const bloqueio = executar(limitar, { ip: "2" });
  assert.equal(bloqueio.statusCode, 429);
  assert.equal(bloqueio.headers["Retry-After"], "2");
  tempo = 5000;
  assert.equal(executar(limitar, { ip: "2" }).passou, true);
});

test("corpo ausente ou malformado ainda consome o limite por IP", () => {
  const limitar = criarLimiteLogin({ limitePorIp: 4 });
  for (const body of [{}, { email: ["teste@example.com"] }, { email: {} }, { email: "x".repeat(191) }]) {
    assert.equal(executar(limitar, { body }).passou, true);
  }
  assert.equal(executar(limitar).statusCode, 429);
  let passou = false;
  limitar({}, { set() {}, status() { return this; }, render() {} }, () => { passou = true; });
  assert.equal(passou, true);
});

test("não altera o corpo nem devolve e-mail, senha ou IP na resposta", () => {
  const limitar = criarLimiteLogin({ limitePorIp: 1 });
  const body = { email: "  Nome@Example.com ", senha: "SenhaSecreta987!" };
  executar(limitar, { body });
  const res = executar(limitar, { body });
  assert.deepEqual(body, { email: "  Nome@Example.com ", senha: "SenhaSecreta987!" });
  const resposta = JSON.stringify(res.dados);
  for (const valor of [body.email, body.senha, "127.0.0.1"]) assert.equal(resposta.includes(valor), false);
  assert.equal(res.view, "pages/erro");
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("tabela cheia recusa novas chaves sem expulsar limites ativos; expiração libera memória", () => {
  let tempo = 0;
  const limitar = criarLimiteLogin({ maxChaves: 2, limitePorConta: 1, janelaMs: 1000, agora: () => tempo });
  assert.equal(executar(limitar).passou, true);
  assert.equal(executar(limitar, { ip: "outro" }).statusCode, 429);
  assert.equal(executar(limitar).statusCode, 429);
  tempo = 1000;
  assert.equal(executar(limitar, { ip: "outro" }).passou, true);
});

test("fábricas independentes não compartilham contadores", () => {
  const um = criarLimiteLogin({ limitePorIp: 1 });
  const dois = criarLimiteLogin({ limitePorIp: 1 });
  executar(um);
  assert.equal(executar(um).statusCode, 429);
  assert.equal(executar(dois).passou, true);
});

test("configuração inválida é recusada", () => {
  for (const opcao of ["limitePorIp", "limitePorConta", "janelaMs", "maxChaves"]) {
    for (const valor of [0, -1, 1.5, Infinity, "2"]) {
      assert.throws(() => criarLimiteLogin({ [opcao]: valor }), TypeError);
    }
  }
  assert.throws(() => criarLimiteLogin({ agora: 1 }), TypeError);
});

test("rota real limita conta e IP antes do banco; cabeçalho forjado não libera tentativas", async (t) => {
  const usuarioModel = require("../app/models/usuarioModel");
  let consultas = 0;
  t.mock.method(usuarioModel, "buscarPorEmail", async () => { consultas++; return null; });
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(session({ secret: "somente-testes-de-limite-login", resave: false, saveUninitialized: false }));
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "../app/views"));
  app.use((req, res, next) => { res.locals.usuario = null; next(); });
  app.use(require("../app/routes/router"));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    servidor.close((erro) => erro ? reject(erro) : resolve());
    servidor.closeAllConnections();
  }));
  await once(servidor, "listening");
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  async function pedir(email, tentativa) {
    const resposta = await fetch(origem + "/login", {
      method: "POST", redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": `192.0.2.${tentativa}` },
      body: new URLSearchParams({ email, senha: "Errada123!" }),
    });
    const texto = await resposta.text();
    return { resposta, texto };
  }
  for (let i = 1; i <= 20; i++) assert.equal((await pedir("ausente@example.com", i)).resposta.status, 401);
  const bloqueioConta = await pedir("  AUSENTE@EXAMPLE.COM  ", 21);
  assert.equal(bloqueioConta.resposta.status, 429);
  assert.equal(consultas, 20);
  assert.match(bloqueioConta.texto, /Muitas tentativas de login/);
  assert.equal(bloqueioConta.resposta.headers.get("cache-control"), "no-store");
  assert.ok(Number(bloqueioConta.resposta.headers.get("retry-after")) > 0);
  assert.equal(bloqueioConta.resposta.headers.get("set-cookie"), null);
  for (let i = 22; i <= 50; i++) assert.equal((await pedir(`ausente${i}@example.com`, i)).resposta.status, 401);
  assert.equal(consultas, 49);
  assert.equal((await pedir("outra@example.com", 51)).resposta.status, 429);
  assert.equal(consultas, 49);
  const recuperar = await fetch(origem + "/recuperar-senha", { redirect: "manual" });
  assert.equal(recuperar.status, 200);
  await recuperar.text();
  const login = await fetch(origem + "/login");
  assert.equal(login.status, 200);
  await login.text();
});
