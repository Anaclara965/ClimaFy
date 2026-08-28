const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

const app = require("../app");

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health check identifica a aplicacao", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok", application: "ClimaFy" });
});

const pageRoutes = [
  "/",
  "/welcome",
  "/sobre",
  "/relatos",
  "/ranking",
  "/new-report",
  "/login",
  "/cadastro-dados-pessoais",
  "/cadastro-preferencias",
  "/cadastro-verificacao",
  "/bairro-bras",
  "/bairro-pinheiros",
  "/adm",
  "/adm-relatos",
  "/adm-usuarios",
  "/adm-relatorios",
  "/adm-investimentos",
  "/adm-moderacao",
];

for (const route of pageRoutes) {
  test(`GET ${route} renderiza sem erro`, async () => {
    const response = await fetch(`${baseUrl}${route}`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/html/);
  });
}

test("links internos das paginas apontam para rotas existentes", async () => {
  const internalLinks = new Set();

  for (const route of pageRoutes) {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await response.text();
    const links = html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi);

    for (const match of links) {
      const href = match[1];
      if (href.startsWith("/") && !href.startsWith("//")) {
        internalLinks.add(new URL(href, baseUrl).pathname);
      }
    }
  }

  for (const route of internalLinks) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.ok(response.status < 400, `${route} devolveu HTTP ${response.status}`);
  }
});

test("endereco antigo de preferencias redireciona para o endereco correto", async () => {
  const response = await fetch(`${baseUrl}/cadastro-preferenciais`, {
    redirect: "manual",
  });

  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "/cadastro-preferencias");
});

test("rota inexistente devolve 404", async () => {
  const response = await fetch(`${baseUrl}/nao-existe`);

  assert.equal(response.status, 404);
});
