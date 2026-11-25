document.addEventListener("DOMContentLoaded", () => {
    const senha = document.getElementById("senha");
    const confirmaSenha = document.getElementById("confirma-senha");
    const form = document.getElementById("registration-form");

    /* ---------- Força da senha ---------- */
    const grupoSenha = senha && senha.closest(".input-group");
    const forcaEl = grupoSenha && grupoSenha.querySelector(".password-strength");
    const bars = forcaEl && forcaEl.querySelectorAll(".bar");
    const strengthText = forcaEl && forcaEl.querySelector(".strength-text");

    // Checklist de requisitos (criado dinamicamente e reutilizável)
    let checklistEl = forcaEl && forcaEl.querySelector(".strength-checklist");
    if (forcaEl && !checklistEl) {
        checklistEl = document.createElement("ul");
        checklistEl.className = "strength-checklist";
        checklistEl.setAttribute("role", "list");
        forcaEl.appendChild(checklistEl);
    }

    const requisitos = window.ClimaFyAuthFields.requisitosSenha;

    function avaliarForca(valor) {
        return requisitos.filter(requisito => requisito.teste(valor)).length;
    }

    function atualizarBarras(pontos) {
        if (!bars || !strengthText) return;
        const tons = [
            { classe: "red", texto: "Fraca" },
            { classe: "red", texto: "Fraca" },
            { classe: "orange", texto: "Média" },
            { classe: "orange", texto: "Média" },
            { classe: "medium", texto: "Boa" },
            { classe: "strong", texto: "Forte" },
        ];
        for (let i = 0; i < bars.length; i += 1) {
            bars[i].className = "bar";
            bars[i].classList.add(i < pontos ? tons[pontos].classe : "gray");
        }
        strengthText.className = "strength-text";
        strengthText.classList.add(`${tons[pontos].classe}-text`);
        strengthText.textContent = tons[pontos].texto;
    }

    function atualizarChecklist(valor) {
        if (!checklistEl) return;
        checklistEl.innerHTML = requisitos
            .map((r) => {
                const ok = r.teste(valor);
                return `<li class="${ok ? "done" : "pending"}">${ok ? "&#10003;" : "&#9432;"} ${r.label}</li>`;
            })
            .join("");
    }

    function validarSenha() {
        const valor = senha ? senha.value : "";
        const pontos = avaliarForca(valor);
        atualizarBarras(pontos);
        atualizarChecklist(valor);

        atualizarErroConfirmacao();
    }

    if (senha) {
        senha.addEventListener("input", validarSenha);
        senha.addEventListener("blur", validarSenha);
    }
    if (confirmaSenha) {
        confirmaSenha.addEventListener("input", validarSenha);
        confirmaSenha.addEventListener("blur", validarSenha);
    }

    /* ---------- Feedback em tempo real na confirmação de senha ---------- */
    let feedbackConfirmacao = null;
    if (confirmaSenha && confirmaSenha.parentElement) {
        feedbackConfirmacao =
            confirmaSenha.parentElement.parentElement.querySelector("#confirma-senha-feedback") ||
            document.getElementById("confirma-senha-feedback");
    }

    function atualizarErroConfirmacao() {
        if (!confirmaSenha) return;

        const vazio = confirmaSenha.value === "";
        const coincide = senha && senha.value === confirmaSenha.value;

        confirmaSenha.classList.remove("input-error", "input-success");

        if (!vazio && !coincide) {
            confirmaSenha.classList.add("input-error");
            if (feedbackConfirmacao) {
                feedbackConfirmacao.className = "field-feedback is-error";
                feedbackConfirmacao.textContent = "As senhas não coincidem.";
            }
        } else {
            if (feedbackConfirmacao) {
                if (vazio) {
                    feedbackConfirmacao.className = "field-feedback";
                    feedbackConfirmacao.textContent = "";
                } else {
                    confirmaSenha.classList.add("input-success");
                    feedbackConfirmacao.className = "field-feedback is-success";
                    feedbackConfirmacao.textContent = "✓ As senhas coincidem";
                }
            }
        }
    }

    /* ---------- Foco no primeiro campo inválido após submit ---------- */
    if (form) {
        form.addEventListener("submit", (event) => {
            // Validação visual antes do submit real
            validarSenha();
            atualizarErroConfirmacao();

            // Bloqueia o envio enquanto as senhas não coincidirem
            if (senha && confirmaSenha && senha.value !== confirmaSenha.value) {
                event.preventDefault();
                confirmaSenha.focus({ preventScroll: false });
                confirmaSenha.reportValidity();
                return;
            }

            const campos = form.querySelectorAll("input, select, textarea");
            for (const campo of campos) {
                if (!campo.checkValidity && !campo.reportValidity) continue;
                if (!campo.checkValidity()) {
                    event.preventDefault();
                    campo.focus({ preventScroll: false });
                    campo.reportValidity();
                    return;
                }
            }
            // Se passar na validação, permite o submit normal
        });
    }

    /* ---------- Bairro: autocomplete com fonte única (/api/bairros) ---------- */
    const bairroBusca = document.getElementById("bairro-busca");
    const bairroId = document.getElementById("bairro");
    const bairroNome = document.getElementById("bairro-nome");
    const bairroLista = document.getElementById("bairro-resultados");
    const bairroFeedback = document.getElementById("bairro-feedback");

    if (form && bairroBusca && bairroLista && window.ClimaFyBairros) {
        function limparBairroEscolhido() {
            bairroId.value = "";
            bairroNome.value = "";
            bairroBusca.setCustomValidity("");
            if (bairroFeedback) {
                bairroFeedback.textContent = "";
                bairroFeedback.className = "field-feedback";
            }
        }

        window.ClimaFyBairros.criarAutocompleteBairros({
            input: bairroBusca,
            lista: bairroLista,
            aoLimpar: limparBairroEscolhido,
            aoEscolher: (bairro) => {
                bairroId.value = String(bairro.id);
                bairroNome.value = bairro.nome;
                bairroBusca.setCustomValidity("");
                if (bairroFeedback) {
                    bairroFeedback.textContent = `Bairro selecionado: ${bairro.nome}`;
                    bairroFeedback.className = "field-feedback is-success";
                }
            },
        });

        // O servidor exige o ID: sem escolha, o próprio navegador bloqueia o envio.
        bairroBusca.addEventListener("blur", () => {
            if (bairroBusca.value.trim() && !bairroId.value) {
                bairroBusca.setCustomValidity("Escolha um bairro da lista sugerida.");
            }
        });
    }

    // Inicializa estado visual
    validarSenha();
});
