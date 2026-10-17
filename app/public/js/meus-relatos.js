document.addEventListener("DOMContentLoaded", () => {
  const { json, card, paginas } = window.ClimaFyRelatos;
  const grid = document.querySelector("#my-reports");
  const feedback = document.querySelector("#my-feedback");
  let pagina = 1, versao = 0;
  async function carregar() {
    const chamada = ++versao;
    feedback.textContent = "Carregando seus relatos…";
    try {
      const dados = await json("/api/meus-relatos?pagina=" + pagina);
      if (chamada !== versao) return;
      grid.replaceChildren(...dados.relatos.map(r => card(r, "/meus-relatos/")));
      feedback.textContent = dados.relatos.length ? dados.paginacao.total + " relatos enviados." : "Você ainda não enviou relatos.";
      paginas(document.querySelector("#my-pagination"), dados.paginacao, nova => { pagina = nova; carregar(); });
    } catch (erro) { if (chamada === versao) { grid.replaceChildren(); feedback.textContent = erro.message; } }
  }
  document.querySelector("#reload-my-reports").addEventListener("click", carregar);
  carregar();
});
