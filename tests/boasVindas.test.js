const test = require("node:test");
const assert = require("node:assert/strict");
const preferenciaModel = require("../app/models/preferenciaModel");
const { mostrarBoasVindas } = require("../app/controllers/preferenciasControllers");

test("boas-vindas mostra todos os bairros salvos da conta logada", async (t) => {
  t.mock.method(preferenciaModel, "listarPreferencias", async (id) => {
    assert.equal(id, 7);
    return { bairros: [{ id: 1, nome: "Brás" }, { id: 2, nome: "Pinheiros" }] };
  });
  let renderizado;
  await mostrarBoasVindas(
    { session: { usuario: { id: 7 }, bairroSugerido: 99 }, query: { usuarioId: 999 } },
    { render: (view, dados) => { renderizado = { view, dados }; } },
    assert.fail
  );
  assert.deepEqual(renderizado, {
    view: "pages/welcome", dados: { resumoBairros: "Brás, Pinheiros" },
  });
});

test("boas-vindas sem bairros nao inventa uma preferencia", async (t) => {
  t.mock.method(preferenciaModel, "listarPreferencias", async () => ({ bairros: [] }));
  let resumo;
  await mostrarBoasVindas(
    { session: { usuario: { id: 7 } } },
    { render: (view, dados) => { resumo = dados.resumoBairros; } },
    assert.fail
  );
  assert.equal(resumo, "Nenhum bairro selecionado");
});

test("boas-vindas encaminha falha do banco sem mostrar dados ficticios", async (t) => {
  const falha = new Error("Banco indisponivel (simulado)");
  t.mock.method(preferenciaModel, "listarPreferencias", async () => { throw falha; });
  let recebido;
  await mostrarBoasVindas(
    { session: { usuario: { id: 7 } } },
    { render: () => assert.fail("Nao deve renderizar quando a consulta falha") },
    (erro) => { recebido = erro; }
  );
  assert.equal(recebido, falha);
});
