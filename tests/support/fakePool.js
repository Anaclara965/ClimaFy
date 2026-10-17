// Pool MySQL falso para os testes de model rodarem SEM banco de dados.
// Devolve as respostas na ordem em que forem pedidas, no formato do mysql2:
//   [[linhas], campos]
function criarPoolFalso({ resultados = [] } = {}) {
  const chamadas = [];
  let indice = 0;

  function proximo() {
    const linhas = resultados[indice] ?? [];
    indice += 1;
    return [linhas, []];
  }

  function criarConexao(rotulo) {
    return {
      query: async (sql, parametros) => {
        chamadas.push({ sql, parametros, rotulo });
        return proximo();
      },
      beginTransaction: async () => chamadas.push({ sql: "BEGIN", rotulo }),
      commit: async () => chamadas.push({ sql: "COMMIT", rotulo }),
      rollback: async () => chamadas.push({ sql: "ROLLBACK", rotulo }),
      release: () => chamadas.push({ sql: "RELEASE", rotulo }),
    };
  }

  const pool = {
    chamadas,
    query: async (sql, parametros) => {
      chamadas.push({ sql, parametros, rotulo: "pool" });
      return proximo();
    },
    getConnection: async () => criarConexao("conexao"),
  };

  return pool;
}

module.exports = { criarPoolFalso };
