const test = require("node:test");
const assert = require("node:assert/strict");

const { buscarBairros } = require("../app/models/bairroModel");

test("encontra Brás mesmo sem acento na busca", () => {
    const resultado = buscarBairros("bras");

    assert.deepEqual(resultado, [
        { id: 1, nome: "Brás" }
    ]);
});

test("retorna lista vazia quando não encontra bairro", () => {
    const resultado = buscarBairros("xyz");

    assert.deepEqual(resultado, []);
});

test("Encontra Vila Madalena", () => {
    const resultado = buscarBairros("VILA");

    assert.deepEqual(resultado, [
        { id: 3, nome: "Vila Madalena" }
    ]);
});

test("retorna todos os bairros quando a busca está vazia", () => {
    const resultado = buscarBairros("");

    assert.deepEqual(resultado, [
        { id: 1, nome: "Brás" },
        { id: 2, nome: "Pinheiros" },
        { id: 3, nome: "Vila Madalena" }
    ]);
});