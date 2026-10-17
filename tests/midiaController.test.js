const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const session = require("express-session");
const { once } = require("node:events");
const usuario = require("../app/models/usuarioModel");
const relatos = require("../app/models/relatoModel");
const midias = require("../app/models/midiaModel");
const service = require("../app/services/midiaService");
const receber = require("../app/middlewares/receberMidiaRelato");
const { MAX_BYTES } = require("../app/helpers/midiaRelato");

test("anexos via rotas reais: multipart, CSRF, autorização, publicação e falhas com storage/banco simulados", async t => {
  const publicId = "12345678-1234-4234-8234-123456789abc";
  const chave = "climafy/relatos/abcdef12-1234-4234-8234-123456789abc";
  const png = Buffer.from("89504e470d0a1a0a0000000d494844520000000100000001", "hex");
  const midia = { id: "99", tipo: "foto", chave_arquivo: chave, mime_type: "image/png", tamanho_bytes: png.length };
  let configurado = true; let papel = "cidadao"; let ativo = true; let publicado = false; let excluido = false;
  let falhaEnvio; let falhaBanco; let falhaLimpeza; let tempo = 0;
  const gravacoes = []; const uploads = []; const limpezas = []; const leituras = []; const consultas = []; const avisos = [];
  t.mock.method(console, "warn", texto => avisos.push(texto));
  t.mock.method(usuario, "buscarPorId", async () => ({ id: 7, status: ativo ? "ativo" : "bloqueado",
    nome: "Teste", papel, email_verificado_em: "2026-10-16" }));
  t.mock.method(service, "disponivel", () => configurado);
  t.mock.method(service, "salvar", async file => {
    uploads.push(file);
    if (falhaEnvio) throw falhaEnvio;
    return { ...midia };
  });
  t.mock.method(service, "remover", async file => { limpezas.push(file); if (falhaLimpeza) throw falhaLimpeza; });
  t.mock.method(service, "ler", async m => { leituras.push(m); return png; });
  t.mock.method(relatos, "criarRelato", async dados => {
    gravacoes.push(dados);
    if (falhaBanco) throw falhaBanco;
    return { publicId, status: "aberto" };
  });
  t.mock.method(midias, "listar", async (id, acesso) => {
    consultas.push({ id, acesso });
    if (id !== publicId || excluido) return null;
    if (!acesso.moderador && acesso.autorId === undefined && !publicado) return null;
    return [{ ...midia }];
  });
  t.mock.method(receber, "receberMidiaRelato", receber.criarReceberMidia({ agora: () => tempo }));
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "segredo-somente-testes-midias", name: "climafy.sid", resave: false, saveUninitialized: false }));
  app.post("/teste/sessao", (req, res) => {
    req.session.usuario = { id: 7 };
    req.session.assinaturaSenha = require("../app/middlewares/exigirAutenticacao").assinaturaSenha({});
    res.json({ ok: true });
  });
  app.use(require("../app/routes/router"));
  app.use(require("../app/routes/router-adm"));
  app.use((erro, req, res, next) => res.status(500).json({ erro: "Erro interno do servidor" }));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => { servidor.close(resolve); servidor.closeAllConnections(); }));
  await once(servidor, "listening");
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  const login = await fetch(origem + "/teste/sessao", { method: "POST" });
  await login.text();
  const cookie = login.headers.get("set-cookie").split(";")[0];
  let token;
  const campos = { titulo: "Alagamento", descricao: "Água na rua", categoria: "alagamento", severidade: "grave",
    bairro: "3", latitude: "-23", longitude: "-46", referencia: "Praça" };
  async function get(caminho, { privado = true, headers = {} } = {}) {
    return fetch(origem + caminho, { headers: { ...(privado ? { Cookie: cookie } : {}), ...headers }, redirect: "manual" });
  }
  async function enviar({ auth = true, csrf = token, tipo = "image/png", arquivo = png, nomeCampo = "foto",
    valores = {}, extras = [], avanca = true, dois = false } = {}) {
    if (avanca) tempo += 3600001;
    const form = new FormData();
    for (const [nome, valor] of Object.entries({ ...campos, ...valores })) form.append(nome, valor);
    for (const [nome, valor] of extras) form.append(nome, valor);
    form.append(nomeCampo, new Blob([arquivo], { type: tipo }), "foto.png");
    if (dois) form.append(nomeCampo, new Blob([arquivo], { type: tipo }), "outra.png");
    const res = await fetch(origem + "/api/relatos", { method: "POST", headers: {
      ...(auth ? { Cookie: cookie } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    }, body: form });
    return { res, corpo: await res.json() };
  }
  await t.test("configuração é privada, fornece CSRF e limites, sem chaves do Cloudinary", async () => {
    assert.equal((await get("/api/relatos/envio/configuracao", { privado: false })).status, 401);
    const res = await get("/api/relatos/envio/configuracao");
    const corpo = await res.json(); token = corpo.csrfToken;
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(corpo.anexos.disponivel, true);
    assert.equal(corpo.anexos.tamanhoMaximoBytes, MAX_BYTES);
    assert.equal(corpo.anexos.somenteNaCriacao, true);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(JSON.stringify(corpo).includes("api_secret"), false);
  });
  await t.test("visitante/CSRF ausente ou de outra sessão não inicia upload", async () => {
    assert.equal((await enviar({ auth: false })).res.status, 401);
    assert.equal((await enviar({ csrf: "" })).res.status, 403);
    assert.equal((await enviar({ csrf: "a".repeat(64) })).res.status, 403);
    assert.equal(uploads.length, 0);
  });
  await t.test("relato com anexo é criado pendente, usando somente identidade e metadados do servidor", async () => {
    const { res, corpo } = await enviar({ extras: [["usuarioId", "999"], ["chave_arquivo", "ataque"]] });
    assert.equal(res.status, 201);
    assert.equal(corpo.publicado, false);
    assert.equal(gravacoes.at(-1).usuarioId, 7);
    assert.equal(gravacoes.at(-1).midia.chave_arquivo, chave);
    assert.equal(gravacoes.at(-1).latitude, -23);
    assert.equal(JSON.stringify(corpo).includes(chave), false);
  });
  await t.test("sem configuração recusa multipart com 503, mas preserva criação JSON sem arquivo", async () => {
    configurado = false;
    const antes = uploads.length;
    assert.equal((await enviar()).res.status, 503);
    const res = await fetch(origem + "/api/relatos", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(campos) });
    assert.equal(res.status, 201); await res.text();
    assert.equal(uploads.length, antes);
    assert.equal(gravacoes.at(-1).midia, undefined);
    configurado = true;
  });
  await t.test("tamanho, tipo falso, campo de arquivo errado, duplicação e texto inválido não chegam ao storage", async () => {
    const antes = uploads.length;
    for (const opcoes of [{ arquivo: Buffer.alloc(MAX_BYTES + 1) }, { tipo: "text/html" },
      { tipo: "image/jpeg" }, { nomeCampo: "arquivo" }, { dois: true },
      { valores: { titulo: "" } }, { extras: [["titulo", "outro"]] }]) {
      assert.equal((await enviar(opcoes)).res.status, 422, JSON.stringify({ ...opcoes, arquivo: undefined }));
    }
    assert.equal(uploads.length, antes);
  });
  await t.test("falha no Cloudinary não cria relato; falha no banco tenta limpar o objeto privado", async () => {
    const antes = gravacoes.length;
    falhaEnvio = Object.assign(new Error("Falha segura no envio"), { status: 502, previsto: true });
    assert.equal((await enviar()).res.status, 502);
    assert.equal(gravacoes.length, antes);
    falhaEnvio = undefined;
    falhaBanco = Object.assign(new Error("Bairro inválido"), { status: 422, campo: "bairro" });
    assert.equal((await enviar()).res.status, 422);
    assert.equal(limpezas.length, 1);
    falhaLimpeza = new Error("segredo do provedor");
    assert.equal((await enviar()).res.status, 422);
    assert.match(avisos.at(-1), /Limpeza pendente/);
    assert.equal(avisos.at(-1).includes("segredo do provedor"), false);
    falhaLimpeza = undefined; falhaBanco = undefined;
  });
  await t.test("commit incerto não apaga anexo potencialmente confirmado nem anuncia sucesso", async () => {
    const antes = limpezas.length;
    falhaBanco = Object.assign(new Error("SQL interno"), { persistenciaIncerta: true });
    const { res, corpo } = await enviar();
    assert.equal(res.status, 500);
    assert.equal(JSON.stringify(corpo).includes("SQL"), false);
    assert.equal(limpezas.length, antes);
    assert.match(avisos.at(-1), /Gravação incerta/);
    falhaBanco = undefined;
  });
  await t.test("limite por conta recusa o 11º multipart da janela antes do storage", async () => {
    tempo += 3600001;
    for (let i = 0; i < 10; i++) assert.equal((await enviar({ avanca: false, valores: { titulo: "" } })).res.status, 422);
    const antes = uploads.length;
    const { res } = await enviar({ avanca: false });
    assert.equal(res.status, 429);
    assert.ok(Number(res.headers.get("retry-after")) > 0);
    assert.equal(uploads.length, antes);
  });
  await t.test("anexo pendente só é consultável pelo autor ou moderador; cidadão não usa a API do painel", async () => {
    const publico = await get(`/api/relatos/${publicId}/midias`, { privado: false });
    assert.equal(publico.status, 404); await publico.text();
    const antes = leituras.length;
    assert.equal((await get(`/api/relatos/${publicId}/midias/99`, { privado: false })).status, 404);
    assert.equal(leituras.length, antes);
    const meu = await get(`/api/meus-relatos/${publicId}/midias?autorId=999`);
    const corpo = await meu.json();
    assert.equal(consultas.at(-1).acesso.autorId, 7);
    assert.equal(corpo.midias[0].url, `/api/meus-relatos/${publicId}/midias/99`);
    assert.equal(JSON.stringify(corpo).includes(chave), false);
    assert.equal((await get(`/api/adm/relatos/${publicId}/midias`)).status, 403);
    papel = "moderador";
    const mod = await get(`/api/adm/relatos/${publicId}/midias`);
    assert.equal(mod.status, 200); await mod.text();
    assert.equal(consultas.at(-1).acesso.moderador, true);
    papel = "cidadao";
  });
  await t.test("publicação libera bytes sem URL remota, com no-store/nosniff e Range para vídeo", async () => {
    publicado = true;
    const caminho = `/api/relatos/${publicId}/midias/99`;
    const res = await get(caminho, { privado: false });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.equal(res.headers.get("location"), null);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), png);
    const parte = await get(caminho, { privado: false, headers: { Range: "bytes=0-3" } });
    assert.equal(parte.status, 206);
    assert.equal(parte.headers.get("content-range"), `bytes 0-3/${png.length}`);
    assert.deepEqual(Buffer.from(await parte.arrayBuffer()), png.subarray(0, 4));
    for (const range of ["bytes=-2", "bytes=4-"]) {
      const r = await get(caminho, { privado: false, headers: { Range: range } });
      assert.equal(r.status, 206); await r.arrayBuffer();
    }
    for (const range of ["bytes=9999-", "bytes=0-1,4-5", "bytes=-0", "inválido"]) {
      const r = await get(caminho, { privado: false, headers: { Range: range } });
      assert.equal(r.status, 416); await r.text();
    }
    publicado = false;
    const antes = leituras.length;
    const retirado = await get(caminho, { privado: false });
    assert.equal(retirado.status, 404); await retirado.text();
    assert.equal(leituras.length, antes);
  });
  await t.test("mídia de outro relato, UUID/ID inválidos, exclusão e conta bloqueada são recusados", async () => {
    for (const caminho of [`/api/meus-relatos/${publicId}/midias/100`, "/api/relatos/invalido/midias",
      `/api/meus-relatos/${publicId}/midias/0`]) {
      const res = await get(caminho); assert.equal(res.status, 404); await res.text();
    }
    excluido = true;
    const res = await get(`/api/meus-relatos/${publicId}/midias/99`);
    assert.equal(res.status, 404); await res.text();
    excluido = false; ativo = false;
    const bloqueado = await get(`/api/meus-relatos/${publicId}/midias`);
    assert.equal(bloqueado.status, 401); await bloqueado.text();
  });
});
