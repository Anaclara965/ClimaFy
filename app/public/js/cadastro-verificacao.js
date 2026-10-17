// Verificação de e-mail.
// Regra do README 4.2: o NAVEGADOR não confirma nada. O timer só controla o
// reenvio/expiração; quem diz "código correto" é POST /api/verificacao.
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("otp-form");
    const inputs = Array.from(document.querySelectorAll(".otp-input"));
    const campoCodigo = document.getElementById("codigo");
    const submitButton = document.getElementById("confirm-code");
    const countdown = document.getElementById("countdown");
    const resendCode = document.getElementById("resend-code");
    const feedback = document.getElementById("otp-feedback");

    if (!form || !inputs.length) return;

    let segundosExpira = Number(form.dataset.segundos) || 0;
    let segundosCooldown = Number(form.dataset.cooldown) || 0;
    let timerExpiracao = null;
    let timerCooldown = null;
    let enviando = false;
    let reenviando = false;

    function formatar(segundos) {
        const minutos = Math.floor(segundos / 60);
        const resto = String(segundos % 60).padStart(2, "0");
        return `${minutos}:${resto}`;
    }

    function setFeedback(mensagem, tipo = "error") {
        feedback.textContent = mensagem;
        feedback.classList.toggle("is-success", tipo === "success");
    }

    function notificar(mensagem, tipo = "error") {
        if (window.SimpleNotify) {
            new window.SimpleNotify({
                title: tipo === "success" ? "Tudo certo" : "Atenção",
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

    function codigoCompleto() {
        return inputs.every((input) => /^\d$/.test(input.value));
    }

    // O botão depende SÓ dos 6 dígitos preenchidos (o timer nunca libera).
    function atualizarBotao() {
        const ativo = codigoCompleto() && segundosExpira > 0 && !enviando;
        submitButton.disabled = !ativo;
        submitButton.classList.toggle("is-active", ativo);
    }

    function atualizarExpiracao() {
        if (segundosExpira <= 0) {
            countdown.textContent = "Código expirado — peça um novo código";
            window.clearInterval(timerExpiracao);
            atualizarBotao();
            return;
        }
        countdown.textContent = `Código expira em ${formatar(segundosExpira)}`;
        segundosExpira -= 1;
    }

    function iniciarExpiracao(segundos) {
        segundosExpira = Number(segundos) || 0;
        window.clearInterval(timerExpiracao);
        atualizarExpiracao();
        timerExpiracao = window.setInterval(atualizarExpiracao, 1000);
    }

    function atualizarCooldown() {
        if (segundosCooldown <= 0) {
            window.clearInterval(timerCooldown);
            resendCode.classList.remove("is-disabled");
            resendCode.setAttribute("aria-disabled", "false");
            resendCode.textContent = "Reenviar";
            return;
        }
        resendCode.classList.add("is-disabled");
        resendCode.setAttribute("aria-disabled", "true");
        resendCode.textContent = `Reenviar em ${segundosCooldown}s`;
        segundosCooldown -= 1;
    }

    function iniciarCooldown(segundos) {
        segundosCooldown = Number(segundos) || 0;
        window.clearInterval(timerCooldown);
        atualizarCooldown();
        timerCooldown = window.setInterval(atualizarCooldown, 1000);
    }

    function sincronizarCampoCodigo() {
        campoCodigo.value = inputs.map((input) => input.value).join("");
        atualizarBotao();
    }

    function limparInputs() {
        inputs.forEach((input) => {
            input.value = "";
        });
        sincronizarCampoCodigo();
    }

    function focusInput(indice) {
        const input = inputs[indice];
        if (input) {
            input.focus();
            input.select();
        }
    }

    function preencherAPartirDe(indice, digitos) {
        const disponiveis = digitos
        .slice(0, inputs.length - indice)
        .split("");
        disponiveis.forEach((digito, offset) => {
            inputs[indice + offset].value = digito;
        });
        focusInput(Math.min(indice + disponiveis.length, inputs.length - 1));
        sincronizarCampoCodigo();
    }

    inputs.forEach((input, indice) => {
        input.addEventListener("input", (event) => {
            const digitos = event.target.value.replace(/\D/g, "");
            if (!digitos) {
                input.value = "";
                sincronizarCampoCodigo();
                return;
            }
            preencherAPartirDe(indice, digitos);
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Backspace" && input.value === "" && indice > 0) {
                event.preventDefault();
                inputs[indice - 1].value = "";
                focusInput(indice - 1);
                sincronizarCampoCodigo();
            }
            if (event.key === "ArrowLeft" && indice > 0) {
                event.preventDefault();
                focusInput(indice - 1);
            }
            if (event.key === "ArrowRight" && indice < inputs.length - 1) {
                event.preventDefault();
                focusInput(indice + 1);
            }
        });

        input.addEventListener("paste", (event) => {
            const colados = event.clipboardData.getData("text").replace(/\D/g, "");
            if (!colados) return;
            event.preventDefault();
            preencherAPartirDe(indice, colados);
        });
    });

    resendCode.addEventListener("click", async (event) => {
        event.preventDefault();
        if (segundosCooldown > 0 || reenviando) return;

        reenviando = true;
        try {
            const resposta = await fetch("/api/verificacao/reenviar", {
                method: "POST",
                headers: { Accept: "application/json" },
            });
            const corpo = await resposta.json();

            if (!resposta.ok) {
                if (corpo.cooldown) iniciarCooldown(corpo.cooldown);
                notificar(corpo.erro ?? "Não foi possível reenviar agora.");
                return;
            }

            limparInputs();
            focusInput(0);
            iniciarExpiracao(corpo.segundosRestantes);
            iniciarCooldown(corpo.cooldown);
            notificar(corpo.mensagem ?? "Enviamos um novo código.", "success");

        } catch (erro) {
            notificar("Falha de conexão ao pedir um novo código.");
        } finally {
            reenviando = false;
        }
        
    });

    form.addEventListener("submit", async (event) => {
        // Sem JavaScript o fluxo não funciona (6 campos viram 1): sempre via fetch.
        event.preventDefault();
        if (submitButton.disabled || enviando) return;

        enviando = true;
        atualizarBotao();
        setFeedback("Conferindo o código...");

        try {
            const resposta = await fetch("/api/verificacao", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ codigo: campoCodigo.value }),
            });
            const corpo = await resposta.json();

            if (!resposta.ok) {
                const mensagem = corpo.erros?.join(" ") ?? corpo.erro ?? "Código inválido.";
                setFeedback(mensagem);
                notificar(mensagem);
                limparInputs();
                focusInput(0);
                // Código expirado/sem tentativas: libera o reenvio imediatamente.
                if (/expirado|tentativas|ativo/i.test(mensagem)) {
                    iniciarCooldown(0);
                }
                return;
            }

            setFeedback(corpo.mensagem ?? "E-mail confirmado!", "success");
            notificar(corpo.mensagem ?? "E-mail confirmado!", "success");
            // A próxima etapa é decidida pelo SERVIDOR (login -> preferências).
            window.location.assign(corpo.redirecionar ?? "/login");
        } catch (erro) {
            setFeedback("Falha de conexão. Tente novamente.");
            notificar("Falha de conexão. Tente novamente.");
        } finally {
            enviando = false;
            atualizarBotao();
        }
    });

    iniciarExpiracao(segundosExpira);
    iniciarCooldown(segundosCooldown);
    sincronizarCampoCodigo();
    focusInput(0);
});
