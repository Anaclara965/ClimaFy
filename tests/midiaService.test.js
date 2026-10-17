const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
const { criarMidiaService } = require("../app/services/midiaService");
const { identificarArquivo, conferirRegistro, MAX_BYTES } = require("../app/helpers/midiaRelato");
const ambiente = { CLOUDINARY_CLOUD_NAME: "teste", CLOUDINARY_API_KEY: "12345", CLOUDINARY_API_SECRET: "segredo-falso" };
const chave = "climafy/relatos/12345678-1234-4234-8234-123456789abc";
const png = Buffer.from("89504e470d0a1a0a0000000d494844520000000100000001", "hex");
const arquivo = { mimetype: "image/png", originalname: "../ataque.exe", buffer: png };
const midia = { chave_arquivo: chave, tipo: "foto", mime_type: "image/png", tamanho_bytes: png.length };

function preparar({ resposta = {}, falha, destroy = { result: "ok" } } = {}) {
  const chamadas = []; const avisos = [];
  const sdk = { uploader: {
    upload_stream(opcoes, callback) {
      chamadas.push({ operacao: "upload", opcoes });
      return new Writable({ write(buffer, encoding, feito) {
        chamadas.push({ operacao: "buffer", buffer });
        feito();
        queueMicrotask(() => callback(falha, { public_id: opcoes.public_id, type: "authenticated",
          resource_type: opcoes.resource_type, format: opcoes.allowed_formats[0], bytes: png.length,
          width: 10, height: 10, duration: 5, ...resposta }));
      } });
    },
    async destroy(id, opcoes) { chamadas.push({ operacao: "destroy", id, opcoes }); return destroy; },
  } };
  return { chamadas, avisos, sdk, service: criarMidiaService({ sdk, ambiente, avisar: texto => avisos.push(texto) }) };
}

test("assinaturas JPEG/PNG/MP4/WebM compatíveis são reconhecidas; extensão não decide", () => {
  assert.equal(identificarArquivo(arquivo).tipo, "foto");
  assert.equal(identificarArquivo({ mimetype: "image/jpeg", buffer: Buffer.from("ffd8ff00ffd9", "hex") }).formato, "jpg");
  assert.equal(identificarArquivo({ mimetype: "video/mp4", buffer: Buffer.from("000000186674797069736f6d00000000", "hex") }).tipo, "video");
  assert.equal(identificarArquivo({ mimetype: "video/webm", buffer: Buffer.concat([Buffer.from("1a45dfa3", "hex"), Buffer.from("xxxxwebmxxxx")]) }).formato, "webm");
});

test("HTML/SVG/executável, MIME mentiroso, vazio e arquivo grande são recusados", () => {
  for (const invalido of [
    { mimetype: "image/png", buffer: Buffer.from("<script>alert(1)</script>") },
    { mimetype: "image/svg+xml", buffer: Buffer.from("<svg/>") },
    { mimetype: "video/mp4", buffer: png }, { mimetype: "image/png", buffer: Buffer.alloc(0) },
    { mimetype: "image/png", buffer: Buffer.alloc(MAX_BYTES + 1) }, {},
  ]) assert.throws(() => identificarArquivo(invalido), { status: 422 });
});

test("sem credenciais o serviço fica indisponível e não tenta rede/SDK", async () => {
  const service = criarMidiaService({ ambiente: {} });
  assert.equal(service.disponivel(), false);
  await assert.rejects(service.salvar(arquivo), { status: 503 });
  for (const CLOUDINARY_CLOUD_NAME of ["../outro", "a/b", "https://outro", ""]) {
    assert.equal(criarMidiaService({ ambiente: { ...ambiente, CLOUDINARY_CLOUD_NAME } }).disponivel(), false);
  }
});

test("upload autenticado usa UUID próprio, limites e configuração por chamada, sem nome original", async () => {
  const { service, chamadas } = preparar();
  const resultado = await service.salvar(arquivo);
  assert.equal(conferirRegistro(resultado), true);
  const opcoes = chamadas[0].opcoes;
  assert.match(opcoes.public_id, /^climafy\/relatos\/[a-f0-9-]{36}$/);
  assert.equal(opcoes.type, "authenticated");
  assert.equal(opcoes.overwrite, false);
  assert.equal(opcoes.resource_type, "image");
  assert.equal(opcoes.signature_algorithm, "sha256");
  assert.deepEqual(opcoes.transformation, [{ flags: "strip_profile" }]);
  assert.deepEqual(chamadas[1].buffer, png);
  assert.equal(JSON.stringify(opcoes).includes("ataque.exe"), false);
});

test("vídeo usa resource_type video e não transforma imagem", async () => {
  const { service, chamadas } = preparar();
  const resultado = await service.salvar({ mimetype: "video/mp4", buffer: Buffer.from("000000186674797069736f6d00000000", "hex") });
  assert.equal(resultado.tipo, "video");
  assert.equal(chamadas[0].opcoes.resource_type, "video");
  assert.equal(chamadas[0].opcoes.transformation, undefined);
});

for (const resposta of [{ type: "upload" }, { format: "svg" }, { width: 0 }, { bytes: MAX_BYTES + 1 },
  { resource_type: "raw" }, { public_id: "chave-arbitraria" }]) {
  test(`resposta insegura do provedor é recusada e limpa apenas chave gerada: ${JSON.stringify(resposta)}`, async () => {
    const { service, chamadas } = preparar({ resposta });
    await assert.rejects(service.salvar(arquivo), { status: 422 });
    const limpeza = chamadas.find(c => c.operacao === "destroy");
    assert.equal(limpeza.id, chamadas[0].opcoes.public_id);
    assert.equal(limpeza.opcoes.type, "authenticated");
  });
}

test("vídeo só com áudio ou longo demais é recusado após decodificação", async () => {
  for (const resposta of [{ duration: 31 }, { duration: 0 }, { height: 0 }]) {
    const { service, chamadas } = preparar({ resposta });
    await assert.rejects(service.salvar({ mimetype: "video/mp4", buffer: Buffer.from("000000186674797069736f6d00000000", "hex") }), { status: 422 });
    assert.ok(chamadas.some(c => c.operacao === "destroy"));
  }
});

test("falha de envio não expõe erro/chaves; grava aviso de reconciliação privada", async () => {
  const { service, avisos, chamadas } = preparar({ falha: new Error("segredo-falso detahes do provedor") });
  await assert.rejects(service.salvar(arquivo), falha => falha.status === 502 && !falha.message.includes("segredo-falso"));
  assert.match(avisos[0], /Upload não confirmado/);
  assert.equal(avisos[0].includes("segredo-falso"), false);
  assert.equal(chamadas.some(c => c.operacao === "destroy"), false, "timeout não prova que upload terminou");
});

test("limpeza falhando é registrada sem vazar credenciais", async () => {
  const { service, avisos } = preparar({ resposta: { format: "errado" }, destroy: { result: "erro" } });
  await assert.rejects(service.salvar(arquivo), { status: 422 });
  assert.match(avisos[0], /Limpeza pendente/);
});

test("leitura usa assinatura real do SDK, prazo curto e fetch servidor, sem redirect", async () => {
  let chamada;
  const service = criarMidiaService({ ambiente, agora: () => 1000000,
    buscar: async (url, opcoes) => { chamada = { url: new URL(url), opcoes }; return new Response(png); } });
  assert.deepEqual(await service.ler(midia), png);
  assert.equal(chamada.url.hostname, "api.cloudinary.com");
  assert.equal(chamada.url.searchParams.get("type"), "authenticated");
  assert.equal(chamada.url.searchParams.get("expires_at"), "1060");
  assert.ok(chamada.url.searchParams.get("signature"));
  assert.equal(chamada.url.toString().includes("segredo-falso"), false);
  assert.equal(chamada.opcoes.redirect, "error");
});

test("leitura recusa chave inválida, redirect inseguro, falha HTTP, tamanho divergente e corpo gigante", async () => {
  const sdk = { utils: { private_download_url: () => "http://127.0.0.1/segredo" } };
  await assert.rejects(criarMidiaService({ sdk, ambiente }).ler(midia), { status: 502 });
  await assert.rejects(criarMidiaService({ ambiente }).ler({ ...midia, chave_arquivo: "https://outro" }), { status: 404 });
  for (const resposta of [new Response("falhou", { status: 403 }), new Response(Buffer.alloc(1)), new Response(Buffer.alloc(MAX_BYTES + 1))]) {
    await assert.rejects(criarMidiaService({ ambiente, buscar: async () => resposta }).ler(midia), { status: 502 });
  }
});
