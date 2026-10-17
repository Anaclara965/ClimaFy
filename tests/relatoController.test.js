const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const session = require("express-session");
const usuarioModel = require("../app/models/usuarioModel");
const relatoModel = require("../app/models/relatoModel");

test("criacao de relatos via rota real, com banco simulado", async (t) => {
  let ativo = true;
  let falha;
  const gravacoes = [];
  t.mock.method(usuarioModel, "buscarPorId", async () => ({
    id: 7, nome: "Teste", papel: "cidadao", status: ativo ? "ativo" : "bloqueado",
    email_verificado_em: "2026-09-30",
  }));
  t.mock.method(relatoModel, "criarRelato", async (dados) => {
    if (falha) throw falha;
    gravacoes.push(dados);
    return { publicId: "uuid-do-relato", status: "aberto" };
  });
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "somente-para-testes-de-relatos", resave: false, saveUninitialized: false }));
  // Login ficticio existe somente neste servidor de testes.
  app.post("/teste/sessao", (req, res) => {
    req.session.usuario = { id: 7 };
    req.session.assinaturaSenha = require("../app/middlewares/exigirAutenticacao").assinaturaSenha({});
    res.json({ ok: true });
  });
  app.use(require("../app/routes/router"));
  app.use((erro, req, res, next) => res.status(500).json({ erro: "Erro interno do servidor" }));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => {
    servidor.close(resolve);
    servidor.closeAllConnections();
  }));
  await once(servidor, "listening");
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  const login = await fetch(origem + "/teste/sessao", { method: "POST" });
  await login.text();
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const valido = {
    titulo: "  Alagamento na rua  ", descricao: "Água acumulada após a chuva.",
    categoria: "ALAGAMENTO", severidade: "Grave", bairro: "3",
    latitude: "-23.55", longitude: "-46.63", referencia: "Perto da praça",
  };
  async function enviar(dados, { autenticado = true, tipo = "application/json" } = {}) {
    const resposta = await fetch(origem + "/api/relatos", {
      method: "POST", headers: {
        "Content-Type": tipo, ...(autenticado ? { Cookie: cookie } : {}),
      }, body: JSON.stringify(dados),
    });
    return { status: resposta.status, corpo: await resposta.json() };
  }
  await t.test("visitante recebe 401 sem gravar", async () => {
    assert.equal((await enviar(valido, { autenticado: false })).status, 401);
    assert.equal(gravacoes.length, 0);
  });
  await t.test("normaliza, mapeia campos e ignora autor/status enviados", async () => {
    const res = await enviar({ ...valido, usuarioId: 999, status: "resolvido", publicado: true });
    assert.equal(res.status, 201);
    assert.deepEqual(res.corpo, {
      ok: true, mensagem: "Relato enviado para moderação.",
      publicId: "uuid-do-relato", status: "aberto", publicado: false,
    });
    assert.deepEqual(gravacoes[0], {
      usuarioId: 7, categoriaSlug: "alagamento", bairroId: 3,
      titulo: "Alagamento na rua", descricao: valido.descricao, gravidade: "grave",
      latitude: -23.55, longitude: -46.63, referencia: valido.referencia,
    });
  });
  await t.test("rejeita campos invalidos sem chamar model", async () => {
    const antes = gravacoes.length;
    for (const alteracao of [
      { titulo: " " }, { titulo: "a".repeat(81) }, { descricao: "a".repeat(281) },
      { categoria: "inventada" }, { severidade: "criticíssima" }, { bairro: "abc" },
      { latitude: "" }, { latitude: 91 }, { longitude: -181 },
      { referencia: "a".repeat(256) }, { titulo: ["titulo"] }, { bairro: {} },
    ]) {
      const res = await enviar({ ...valido, ...alteracao });
      assert.equal(res.status, 422, JSON.stringify(alteracao));
      assert.ok(res.corpo.erros.length);
    }
    assert.equal((await enviar([])).status, 422);
    assert.equal(gravacoes.length, antes);
  });
  await t.test("referencia opcional e coordenadas zero sao aceitas", async () => {
    const { referencia, ...dados } = valido;
    assert.equal((await enviar({ ...dados, latitude: 0, longitude: 0 })).status, 201);
    assert.equal(gravacoes.at(-1).latitude, 0);
    assert.equal(gravacoes.at(-1).referencia, undefined);
  });
  await t.test("formulario tradicional nao e aceito por esta API", async () => {
    assert.equal((await enviar(valido, { tipo: "application/x-www-form-urlencoded" })).status, 415);
  });
  await t.test("erros previstos do model preservam status", async () => {
    for (const status of [422, 403]) {
      falha = Object.assign(new Error("Operação recusada."), { status, campo: "bairro" });
      const res = await enviar(valido);
      assert.equal(res.status, status);
      assert.deepEqual(res.corpo.erros, ["Operação recusada."]);
    }
    falha = undefined;
  });
  await t.test("falha inesperada nao vira sucesso nem expoe SQL", async () => {
    falha = new Error("SQL com detalhes internos");
    const res = await enviar(valido);
    assert.equal(res.status, 500);
    assert.equal(JSON.stringify(res.corpo).includes("SQL"), false);
    falha = undefined;
  });
  await t.test("usuario bloqueado perde acesso antes de gravar", async () => {
    const antes = gravacoes.length;
    ativo = false;
    assert.equal((await enviar(valido)).status, 401);
    assert.equal(gravacoes.length, antes);
  });
});
