(function () {
    function criarBuscaEndereco({ input, lista, botao, feedback, aoEscolher }) {
        let versao = 0;
        let temporizador;
        let requisicao;

        function fechar() {
            versao++;
            clearTimeout(temporizador);
            requisicao?.abort();
            lista.hidden = true;
            lista.replaceChildren();
            input.setAttribute("aria-expanded", "false");
            botao.disabled = false;
        }

        async function buscar() {
            const termo = input.value.trim();
            fechar();
            if (termo.length < 3) {
                feedback.textContent = "Digite pelo menos 3 caracteres, incluindo a cidade.";
                return;
            }
            const atual = versao;
            requisicao = new AbortController();
            botao.disabled = true;
            feedback.textContent = "Buscando endereços…";
            try {
                const resposta = await fetch(`/api/localizacao/endereco?busca=${encodeURIComponent(termo)}`, {
                    signal: requisicao.signal, headers: { Accept: "application/json" }
                });
                const dados = await resposta.json();
                if (atual !== versao) return;
                if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível buscar o endereço.");
                dados.forEach((local) => {
                    const item = document.createElement("li");
                    const opcao = document.createElement("button");
                    opcao.type = "button";
                    opcao.setAttribute("role", "option");
                    opcao.textContent = local.endereco;
                    opcao.addEventListener("click", () => {
                        fechar();
                        input.value = local.endereco;
                        feedback.textContent = "Endereço selecionado. Confira o ponto no mapa.";
                        aoEscolher(local);
                    });
                    opcao.addEventListener("keydown", (evento) => {
                        const botoes = Array.from(lista.querySelectorAll("button"));
                        const indice = botoes.indexOf(opcao);
                        if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
                            evento.preventDefault();
                            botoes[(indice + (evento.key === "ArrowDown" ? 1 : -1) + botoes.length) % botoes.length].focus();
                        } else if (evento.key === "Escape") {
                            fechar();
                            input.focus();
                        }
                    });
                    item.appendChild(opcao);
                    lista.appendChild(item);
                });
                lista.hidden = dados.length === 0;
                input.setAttribute("aria-expanded", String(dados.length > 0));
                feedback.textContent = dados.length
                    ? "Escolha um endereço da lista e confira o local do problema."
                    : "Nenhum endereço encontrado. Inclua rua, número e cidade ou escolha no mapa.";
            } catch (erro) {
                if (erro.name !== "AbortError" && atual === versao) feedback.textContent = erro.message;
            } finally {
                if (atual === versao) botao.disabled = false;
            }
        }

        input.addEventListener("input", () => {
            fechar();
            feedback.textContent = "";
            if (input.value.trim().length >= 3) temporizador = setTimeout(buscar, 700);
        });
        input.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                buscar();
            } else if (evento.key === "ArrowDown" && !lista.hidden) {
                evento.preventDefault();
                lista.querySelector("button")?.focus();
            } else if (evento.key === "Escape") fechar();
        });
        botao.addEventListener("click", buscar);
        document.addEventListener("click", (evento) => {
            if (evento.target !== input && evento.target !== botao && !lista.contains(evento.target)) fechar();
        });
        return { fechar };
    }
    window.ClimaFyEnderecos = { criarBuscaEndereco };
})();
