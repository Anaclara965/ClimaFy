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
        if (confirmaSenha && senha.value !== confirmaSenha.value) {
            confirmaSenha.setCustomValidity("As senhas não coincidem.");
        } else {
            confirmaSenha.setCustomValidity("");
        }
    }

    if (senha) {
        senha.addEventListener("input", validarSenha);
        senha.addEventListener("blur", validarSenha);
    }
    if (confirmaSenha) {
        confirmaSenha.addEventListener("input", validarSenha);
        confirmaSenha.addEventListener("blur", validarSenha);
    }

    /* ---------- Feedback inline na confirmação de senha ---------- */
    let erroConfirmacao = null;
    if (confirmaSenha && confirmaSenha.parentElement) {
        erroConfirmacao = document.createElement("small");
        erroConfirmacao.className = "error-message";
        erroConfirmacao.id = "confirma-senha-error";
        erroConfirmacao.setAttribute("role", "alert");
        erroConfirmacao.setAttribute("aria-live", "polite");
        erroConfirmacao.textContent = "";
        confirmaSenha.parentElement.appendChild(erroConfirmacao);
    }

    function atualizarErroConfirmacao() {
        if (!confirmaSenha || !erroConfirmacao) return;
        if (senha.value !== confirmaSenha.value && confirmaSenha.value !== "") {
            erroConfirmacao.textContent = "As senhas não coincidem. Tente novamente.";
            erroConfirmacao.style.display = "block";
            confirmaSenha.setCustomValidity("As senhas não coincidem.");
        } else {
            erroConfirmacao.textContent = "";
            erroConfirmacao.style.display = "none";
            confirmaSenha.setCustomValidity("");
        }
    }

    if (confirmaSenha) {
        confirmaSenha.addEventListener("input", atualizarErroConfirmacao);
        confirmaSenha.addEventListener("blur", atualizarErroConfirmacao);
    }

    /* ---------- Foco no primeiro campo inválido após submit ---------- */
    if (form) {
        form.addEventListener("submit", (event) => {
            // Validação visual antes do submit real
            validarSenha();
            atualizarErroConfirmacao();

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
