document.addEventListener("DOMContentLoaded", () => {
    const senha = document.getElementById("senha");
    const confirmaSenha = document.getElementById("confirma-senha");
    const form = document.getElementById("registration-form");

    /* ---------- Força da senha ---------- */
    const forcaEl = senha && senha.parentElement.querySelector(".password-strength");
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

    const requisitos = [
        { id: "len", label: "Mínimo 8 caracteres", teste: (v) => v.length >= 8 },
        { id: "upper", label: "Pelo menos uma letra maiúscula", teste: (v) => /[A-Z]/.test(v) },
        { id: "lower", label: "Pelo menos uma letra minúscula", teste: (v) => /[a-z]/.test(v) },
        { id: "number", label: "Pelo menos um número", teste: (v) => /[0-9]/.test(v) },
        { id: "symbol", label: "Pelo menos um símbolo (!@#$%)", teste: (v) => /[^A-Za-z0-9]/.test(v) },
    ];

    function avaliarForca(valor) {
        let pontos = 0;
        if (valor.length >= 8) pontos += 1;
        if (/[A-Z]/.test(valor)) pontos += 1;
        if (/[a-z]/.test(valor)) pontos += 1;
        if (/[0-9]/.test(valor)) pontos += 1;
        if (/[^A-Za-z0-9]/.test(valor)) pontos += 1;
        return pontos;
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

        // Validação de confirmação reforçada
        if (senha && confirmaSenha && senha.value !== confirmaSenha.value) {
            confirmaSenha.setCustomValidity("As senhas não coincidem.");
        } else if (confirmaSenha) {
            confirmaSenha.setCustomValidity("");
        }

        // A confirmação também reage quando a senha principal muda
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

    /* ---------- Toggle de visibilidade de senha (olhinho) ---------- */
    // Reutilizável: funciona para qualquer campo de senha dentro de .password-field
    function configurarToggleSenha(input) {
        if (!input || !input.parentElement) return;
        const botao = input.parentElement.querySelector(".password-toggle");
        if (!botao) return;
        const icone = botao.querySelector("i");

        botao.addEventListener("click", () => {
            const visivel = input.type === "password";
            input.type = visivel ? "text" : "password";
            if (icone) {
                icone.className = visivel ? "ph ph-eye-slash" : "ph ph-eye";
            }
            botao.setAttribute("aria-label", visivel ? "Ocultar senha" : "Mostrar senha");
            botao.setAttribute("aria-pressed", String(visivel));
            input.focus({ preventScroll: true });
        });
    }

    configurarToggleSenha(senha);
    configurarToggleSenha(confirmaSenha);

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
            confirmaSenha.setCustomValidity("As senhas não coincidem.");
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
            confirmaSenha.setCustomValidity("");
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

    // Inicializa estado visual
    validarSenha();
});
