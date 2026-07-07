document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("otp-form");
    const inputs = Array.from(document.querySelectorAll(".otp-input"));
    const submitButton = document.getElementById("confirm-code");
    const countdown = document.getElementById("countdown");
    const resendCode = document.getElementById("resend-code");
    const feedback = document.getElementById("otp-feedback");
    const initialCountdown = 5;
    let remainingSeconds = initialCountdown;
    let timerId;

    function formatCountdown(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secondsLeft = String(seconds % 60).padStart(2, "0");
        return `${minutes}:${secondsLeft}`;
    }

    function setFeedback(message, type = "error") {
        feedback.textContent = message;
        feedback.classList.toggle("is-success", type === "success");
    }

    function updateSubmitState() {
        const isComplete = inputs.every((input) => /^\d$/.test(input.value));
        const isTimerFinished = remainingSeconds <= 0; 
        
        const shouldBeActive = isComplete || isTimerFinished;

        submitButton.disabled = !shouldBeActive;
        submitButton.classList.toggle("is-active", shouldBeActive);
    }

    // FUNÇÃO ATUALIZADA: Chama a atualização do botão quando o tempo zera para ativá-lo
    function updateCountdown() {
        if (remainingSeconds <= 0) {
            countdown.textContent = "Tempo esgotado - Pode avançar"; // Você pode mudar esse texto se quiser
            window.clearInterval(timerId);
            updateSubmitState(); 
            return;
        }

        countdown.textContent = `Código expira em ${formatCountdown(remainingSeconds)}`;
        remainingSeconds -= 1;
    }

    function startCountdown() {
        window.clearInterval(timerId);
        remainingSeconds = initialCountdown;
        updateCountdown();
        timerId = window.setInterval(updateCountdown, 1000);
    }

    function focusInput(index) {
        const input = inputs[index];

        if (input) {
            input.focus();
            input.select();
        }
    }

    function fillInputsFrom(index, digits) {
        const availableDigits = digits.slice(0, inputs.length - index);

        availableDigits.forEach((digit, offset) => {
            inputs[index + offset].value = digit;
        });

        const nextIndex = Math.min(index + availableDigits.length, inputs.length - 1);
        focusInput(nextIndex);
        updateSubmitState();
    }

    inputs.forEach((input, index) => {
        input.addEventListener("input", (event) => {
            const digits = event.target.value.replace(/\D/g, "");

            if (!digits) {
                input.value = "";
                updateSubmitState();
                return;
            }

            fillInputsFrom(index, digits);
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Backspace" && input.value === "" && index > 0) {
                event.preventDefault();
                inputs[index - 1].value = "";
                focusInput(index - 1);
                updateSubmitState();
            }

            if (event.key === "ArrowLeft" && index > 0) {
                event.preventDefault();
                focusInput(index - 1);
            }

            if (event.key === "ArrowRight" && index < inputs.length - 1) {
                event.preventDefault();
                focusInput(index + 1);
            }
        });

        input.addEventListener("paste", (event) => {
            const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");

            if (!pastedDigits) {
                return;
            }

            event.preventDefault();
            fillInputsFrom(index, pastedDigits);
        });
    });

    resendCode.addEventListener("click", (event) => {
        event.preventDefault();
        inputs.forEach((input) => {
            input.value = "";
        });
        updateSubmitState();
        startCountdown();
        focusInput(0);
        setFeedback("Um novo código foi enviado para seu e-mail.", "success");
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        if (submitButton.disabled) {
            setFeedback("Aguarde o tempo acabar ou digite o código.");
            return;
        }
        window.location.href = "cadastro-preferencias.html";
    });

    startCountdown();
    updateSubmitState();
    focusInput(0);
});