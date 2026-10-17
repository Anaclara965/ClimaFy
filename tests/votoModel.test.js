const test = require("node:test");
const assert = require("node:assert/strict");
const { criarVotoModel } = require("../app/models/votoModel");
const { criarPoolFalso } = require("./support/fakePool");
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pedido = { publicId: id, usuarioId: 7, votar: true };
const conta = [{ id: 7 }], relato = [{ id: 10, usuario_id: 9 }], publicado = [{ id: 10 }];

test("estado dos votos usa view, parâmetros e identidade privada sem expor autor interno", async () => {
  const pool = criarPoolFalso({ resultados: [[{ public_id: id, votos: "3", votado: "1", proprio: "0", usuario_id: 9 },
    { public_id: "outro", votos: "0", votado: "0", proprio: "1" }]] });
  const resultado = await criarVotoModel(pool).consultar({ publicIds: [id, "outro"], usuarioId: 7 });
  assert.deepEqual(resultado, [
    { publicId: id, votos: 3, votado: true, proprio: false, podeVotar: true },
    { publicId: "outro", votos: 0, votado: false, proprio: true, podeVotar: false },
  ]);
  assert.match(pool.chamadas[0].sql, /FROM vw_relatos_publicos/);
  assert.match(pool.chamadas[0].sql, /IN \(\?, \?\)/);
  assert.deepEqual(pool.chamadas[0].parametros, [7, 7, id, "outro"]);
  assert.equal(pool.chamadas[0].sql.includes(id), false);
});

test("voto novo trava conta e relato, confere publicação e conta na mesma transação", async () => {
  const pool = criarPoolFalso({ resultados: [conta, relato, publicado, [], { affectedRows: 1 }, [{ votos: "1" }]] });
  const resultado = await criarVotoModel(pool).definir(pedido);
  assert.deepEqual(resultado, { publicId: id, votos: 1, votado: true, proprio: false, podeVotar: true });
  assert.ok(pool.chamadas.every(c => c.rotulo === "conexao"));
  assert.match(pool.chamadas[1].sql, /email_verificado_em IS NOT NULL.*FOR UPDATE/s);
  assert.match(pool.chamadas[2].sql, /deleted_at IS NULL FOR UPDATE/);
  assert.match(pool.chamadas[3].sql, /FROM vw_relatos_publicos WHERE id = \?/);
  assert.deepEqual(pool.chamadas[5].parametros, [10, 7]);
  assert.match(pool.chamadas[5].sql, /INSERT INTO relato_votos/);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["COMMIT", "RELEASE"]);
  assert.equal(pool.chamadas.some(c => /UPDATE relatos|historico_status|INSERT INTO moderacoes/.test(c.sql)), false);
});

test("repetir PUT existente não insere nem altera data do voto", async () => {
  const pool = criarPoolFalso({ resultados: [conta, relato, publicado, [{ usuario_id: 7 }], [{ votos: 2 }]] });
  const resultado = await criarVotoModel(pool).definir(pedido);
  assert.equal(resultado.votado, true); assert.equal(resultado.votos, 2);
  assert.equal(pool.chamadas.some(c => /INSERT|UPDATE|DELETE/.test(c.sql.split("FROM")[0]) && !c.sql.startsWith("SELECT")), false);
});

for (const quantidade of [0, 1]) test(`DELETE com ${quantidade} voto removido é idempotente e não remove de terceiros`, async () => {
  const pool = criarPoolFalso({ resultados: [conta, relato, publicado, { affectedRows: quantidade }, [{ votos: 1 }]] });
  const resultado = await criarVotoModel(pool).definir({ ...pedido, votar: false });
  assert.equal(resultado.votado, false); assert.equal(resultado.votos, 1);
  assert.equal(pool.chamadas[4].sql, "DELETE FROM relato_votos WHERE relato_id = ? AND usuario_id = ?");
  assert.deepEqual(pool.chamadas[4].parametros, [10, 7]);
});

for (const [nome, resultados, status] of [
  ["conta bloqueada, excluída ou não verificada", [[]], 403],
  ["relato inexistente/excluído", [conta, []], 404],
  ["pendente, rejeitado ou com ajuste solicitado", [conta, relato, []], 404],
  ["próprio relato mesmo com tipo numérico diferente", [conta, [{ id: 10, usuario_id: "7" }], publicado], 403],
]) test(`voto recusa ${nome}`, async () => {
  const pool = criarPoolFalso({ resultados });
  await assert.rejects(criarVotoModel(pool).definir(pedido), { status, previsto: true });
  assert.equal(pool.chamadas.some(c => /^(INSERT|DELETE|UPDATE)\b/.test(c.sql.trim())), false);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["ROLLBACK", "RELEASE"]);
});

test("erro após inserir faz rollback em vez de confirmar contador inventado", async () => {
  const pool = criarPoolFalso({ resultados: [conta, relato, publicado, [], { affectedRows: 1 }] });
  const obter = pool.getConnection;
  pool.getConnection = async () => {
    const conexao = await obter(), query = conexao.query;
    conexao.query = async (sql, valores) => {
      if (sql.startsWith("SELECT COUNT")) throw new Error("Falha simulada no contador");
      return query(sql, valores);
    };
    return conexao;
  };
  await assert.rejects(criarVotoModel(pool).definir(pedido), /Falha simulada/);
  assert.deepEqual(pool.chamadas.slice(-2).map(c => c.sql), ["ROLLBACK", "RELEASE"]);
  assert.equal(pool.chamadas.some(c => c.sql === "COMMIT"), false);
});

// Simula travas por usuário/relato, mas executa o model real. Não é um MySQL real.
function poolConcorrente() {
  const votos = new Set(), travas = new Map();
  let publicado = true;
  return { votos, ocultar() { publicado = false; },
    getConnection: async () => {
      const soltar = [];
      async function travar(chave) {
        const anterior = travas.get(chave) || Promise.resolve();
        let liberar;
        const proxima = new Promise(resolve => { liberar = resolve; });
        travas.set(chave, proxima); await anterior;
        soltar.push(() => { liberar(); if (travas.get(chave) === proxima) travas.delete(chave); });
      }
      return {
        async beginTransaction() {},
        async query(sql, valores) {
          if (sql.includes("FROM usuarios")) { await travar("usuario:" + valores[0]); return [[{ id: valores[0] }]]; }
          if (sql.includes("FROM relatos WHERE")) { await travar("relato:10"); return [relato]; }
          if (sql.includes("vw_relatos_publicos")) return [publicado ? [{ id: 10 }] : []];
          if (sql.startsWith("SELECT usuario_id")) return [votos.has(valores[1]) ? [{ usuario_id: valores[1] }] : []];
          if (sql.startsWith("INSERT")) {
            assert.equal(votos.has(valores[1]), false, "Tentou voto duplicado"); votos.add(valores[1]); return [{ affectedRows: 1 }];
          }
          if (sql.startsWith("DELETE")) return [{ affectedRows: Number(votos.delete(valores[1])) }];
          if (sql.startsWith("SELECT COUNT")) return [[{ votos: votos.size }]];
          throw new Error("SQL inesperado no simulador de concorrência");
        },
        async commit() { while (soltar.length) soltar.pop()(); },
        async rollback() { while (soltar.length) soltar.pop()(); },
        release() {},
      };
    },
  };
}

test("pedidos simultâneos do mesmo usuário somam só um voto e retiradas repetidas são seguras", async () => {
  const pool = poolConcorrente(), model = criarVotoModel(pool);
  const resultados = await Promise.all(Array.from({ length: 8 }, () => model.definir(pedido)));
  assert.equal(pool.votos.size, 1); assert.ok(resultados.every(r => r.votos === 1 && r.votado));
  await Promise.all(Array.from({ length: 8 }, () => model.definir({ ...pedido, votar: false })));
  assert.equal(pool.votos.size, 0);
});

test("dois usuários simultâneos têm votos independentes e contagem consistente", async () => {
  const pool = poolConcorrente(), model = criarVotoModel(pool);
  const resultados = await Promise.all([model.definir(pedido), model.definir({ ...pedido, usuarioId: 8 })]);
  assert.equal(pool.votos.size, 2); assert.deepEqual(resultados.map(r => r.votos).sort(), [1, 2]);
  await model.definir({ ...pedido, votar: false });
  assert.deepEqual([...pool.votos], [8]);
  pool.ocultar(); await assert.rejects(model.definir(pedido), { status: 404 });
  assert.deepEqual([...pool.votos], [8]);
});
