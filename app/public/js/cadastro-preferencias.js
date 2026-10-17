// Preferências do usuário.
// Substitui a lista hardcoded de 8 bairros e a mensagem de sucesso falsa:
// tudo agora vem de /api/bairros e é gravado por POST /api/preferencias.
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("preferences-form");
    const input = document.getElementById("neighborhood-input");
    const results = document.getElementById("neighborhood-results");
    const selectedList = document.getElementById("selected-neighborhoods");
    const feedback = document.getElementById("preferences-feedback");
    const frequencyOptions = Array.from(document.querySelectorAll(".frequency-option"));
    const categorias = Array.from(document.querySelectorAll('input[name="categorias"]'));
    const frequencias = Array.from(document.querySelectorAll('input[name="frequencia"]'));

    if (!form) return;

    // O servidor manda o que já está salvo (Map: id do bairro -> nome).
    const iniciais = window.CLIMAFY_PREFERENCIAS ?? { bairros: [], categorias: [], frequencia: "diario" };
    const selecionados = new Map(
        (iniciais.bairros ?? []).map((bairro) => [Number(bairro.id), bairro.nome])
    );

    function setFeedback(mensagem, tipo = "error") {
        feedback.textContent = mensagem;
        feedback.classList.toggle("is-success", tipo === "success");
    }

    function notificar(mensagem, tipo = "success") {
        if (window.SimpleNotify) {
            new window.SimpleNotify({
                title: tipo === "success" ? "Preferências" : "Atenção",
                text: mensagem,
                type: tipo === "success" ? "success" : "error",
                position: "top-right",
                autoclose: true,
                autocloseTimeout: 4000,
            });
            return;
        }
        setFeedback(mensagem, tipo);
    }

    function renderSelectedNeighborhoods() {
        selectedList.innerHTML = "";

        selecionados.forEach((nome, id) => {
            const chip = document.createElement("li");
            chip.className = "neighborhood-chip";
            chip.dataset.id = String(id);

            const texto = document.createElement("span");
            texto.textContent = nome;

            const remover = document.createElement("button");
            remover.type = "button";
            remover.setAttribute("aria-label", `Remover ${nome}`);
            remover.textContent = "×";
            remover.addEventListener("click", () => {
                selecionados.delete(id);
                renderSelectedNeighborhoods();
            });

            chip.append(texto, remover);
            selectedList.appendChild(chip);
        });
    }

    function sincronizarFrequencia() {
        frequencyOptions.forEach((option) => {
            const radio = option.querySelector("input");
            option.classList.toggle("is-selected", radio.checked);
        });
    }

    // Estado inicial vindo do banco.
    categorias.forEach((checkbox) => {
        checkbox.checked = (iniciais.categorias ?? []).includes(checkbox.value);
    });
    frequencias.forEach((radio) => {
        radio.checked = radio.value === (iniciais.frequencia ?? "diario");
    });

    frequencyOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const radio = option.querySelector("input");
            radio.checked = true;
            sincronizarFrequencia();
        });
    });

    if (input && results && window.ClimaFyBairros) {
        window.ClimaFyBairros.criarAutocompleteBairros({
            input,
            lista: results,
            aoEscolher: (bairro) => {
                selecionados.set(Number(bairro.id), bairro.nome);
                input.value = "";
                renderSelectedNeighborhoods();
            },
        });
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const botao = form.querySelector(".btn-save");
        if (botao) botao.disabled = true;
        setFeedback("Salvando preferências...");

        const payload = {
            bairros: [...selecionados.keys()],
            categorias: categorias.filter((c) => c.checked).map((c) => c.value),
            frequencia: frequencias.find((radio) => radio.checked)?.value ?? "diario",
        };

        try {
            const resposta = await fetch("/api/preferencias", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });
            const corpo = await resposta.json();

            // Regra do README 6: só mostra sucesso DEPOIS do 2xx do servidor.
            if (!resposta.ok) {
                const mensagem = corpo.erros?.join(" ") ?? corpo.erro ?? "Não foi possível salvar.";
                setFeedback(mensagem);
                notificar(mensagem, "error");
                return;
            }

            setFeedback(corpo.mensagem ?? "Preferências salvas com sucesso.", "success");
            notificar(corpo.mensagem ?? "Preferências salvas com sucesso.");
            window.location.assign(corpo.redirecionar ?? "/welcome");
        } catch (erro) {
            const mensagem = "Falha de conexão. Tente novamente.";
            setFeedback(mensagem);
            notificar(mensagem, "error");
        } finally {
            if (botao) botao.disabled = false;
        }
    });

    renderSelectedNeighborhoods();
    sincronizarFrequencia();
});
