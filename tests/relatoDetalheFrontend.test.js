const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ejs = require("ejs");

const arquivo = path.join(__dirname, "../app/views/pages/relato-detalhe.ejs");
const relato = {
  publicId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  versao: "3",
  titulo: "Alagamento na Rua Central",
  descricao: "A água cobre a calçada.",
  categoria: "Alagamento",
  bairro: "Centro",
  cidade: "São Paulo",
  severidade: "grave",
  status: "aberto",
  latitude: -23.55,
  longitude: -46.63,
  referencia: "Próximo à praça",
  criadoEm: "2026-10-28T22:49:22.000Z",
  votos: 4,
};

async function renderizar(modo = "publico") {
  return ejs.renderFile(arquivo, {
    usuario: null,
    relato,
    modo,
    csrfToken: "a".repeat(64),
  });
}

test("detalhe agrupa informações sem perder coordenadas, anexos ou mapa", async () => {
  const html = await renderizar();
  assert.match(html, /class="detail-overview"/);
  assert.match(html, /id="detail-title">Alagamento na Rua Central/);
  assert.match(html, /detail-status--open/);
  assert.match(html, /detail-severity--high/);
  assert.match(html, /id="detail-media"/);
  assert.match(html, /data-midias-url="\/api\/relatos\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/midias"/);
  assert.match(html, /id="detail-map" data-latitude="-23\.55" data-longitude="-46\.63"/);
  assert.match(html, /Coordenadas: <strong>-23\.55000, -46\.63000<\/strong>/);
  assert.match(html, /openstreetmap\.org\/\?mlat=-23\.55&amp;mlon=-46\.63/);
});

test("detalhe mantém ações e endpoint de anexos conforme o papel", async () => {
  const autor = await renderizar("autor");
  assert.match(autor, /id="delete-report"/);
  assert.match(autor, /href="\/meus-relatos\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/editar"/);

  const moderador = await renderizar("moderador");
  assert.match(moderador, /data-midias-url="\/api\/adm\/relatos\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/midias"/);
  assert.match(moderador, /id="situation-form"/);
});
