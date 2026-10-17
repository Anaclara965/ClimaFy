// Autocomplete de bairros com fonte UNICA: GET /api/bairros (dados reais do banco).
// Usado pelo cadastro (escolher o bairro de acompanhamento) e pelas preferências.
// Substitui a lista hardcoded de 8 bairros que existia em cadastro-preferencias.js.
(function () {
  const URL_API = "/api/bairros";
  const ATRASO_BUSCA_MS = 250;
  async function buscar(termo, { signal } = {}) {

    const resposta = await fetch(`${URL_API}?busca=${encodeURIComponent(termo)}`, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null);
      throw new Error(corpo?.erro ?? "Não foi possível buscar os bairros agora.");
    }

    return resposta.json();
  }

  function criarAutocompleteBairros({ input, lista, aoEscolher, aoLimpar }) {
    let temporizador = null;
    let itens = [];
    let buscadorAtual = null;
    let versao = 0;

    function fechar() {
      versao++;
      window.clearTimeout(temporizador);
      buscadorAtual?.abort();
      lista.hidden = true;
      lista.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
    }

    function selecionar(bairro) {
      input.value = bairro.nome;
      fechar();
      aoEscolher?.(bairro);
    }

    function limpar() {
      input.value = "";
      fechar();
      aoLimpar?.();
    }

    function abrir() {
      lista.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function pintar(mensagem) {
      lista.innerHTML = "";
      const item = document.createElement("li");
      item.className = "empty-result";
      item.textContent = mensagem;
      lista.appendChild(item);
      abrir();
    }

    function renderizar(encontrados) {
      itens = encontrados;
      lista.innerHTML = "";

      if (!encontrados.length) {
        pintar("Nenhum bairro encontrado");
        return;
      }

      encontrados.forEach((bairro) => {
        const item = document.createElement("li");
        const botao = document.createElement("button");
        botao.type = "button";
        botao.setAttribute("role", "option");
        botao.dataset.id = bairro.id;
        botao.textContent = bairro.cidade ? `${bairro.nome} — ${bairro.cidade}` : bairro.nome;
        botao.addEventListener("click", () => {
          selecionar(bairro);
        });
        item.appendChild(botao);
        lista.appendChild(item);
      });

      abrir();
    }

    input.addEventListener("input", () => {
      const termo = input.value.trim();
      const atual = ++versao;
      buscadorAtual?.abort();
      // O usuário editou o texto: a escolha anterior deixa de ser válida.
      aoLimpar?.();

      window.clearTimeout(temporizador);
      if (termo.length < 2) {
        fechar();
        return;
      }

      temporizador = window.setTimeout(async () => {
        buscadorAtual = new AbortController();
        try {
          const encontrados = await buscar(termo, { signal: buscadorAtual.signal });
          if (atual !== versao) return;
          renderizar(encontrados);
        } catch (erro) {
          if (erro.name === "AbortError" || atual !== versao) return;
          pintar(erro.message);
        }
      }, ATRASO_BUSCA_MS);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") fechar();
    });

    document.addEventListener("click", (event) => {
      if (!lista.hidden && !lista.contains(event.target) && event.target !== input) {
        fechar();
      }
    });

    return { fechar, selecionar, limpar };
  }

  window.ClimaFyBairros = { buscar, criarAutocompleteBairros };
})();
