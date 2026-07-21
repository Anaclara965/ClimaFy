document.addEventListener("DOMContentLoaded", () => {
    const shareButton = document.getElementById("share-button");
    const feedback = document.getElementById("welcome-feedback");
    const inviteText = "Estou usando o ClimaFy para acompanhar relatos climaticos no meu bairro. Vem participar tambem!";

    function showFeedback(message) {
        feedback.textContent = message;
        window.setTimeout(() => {
            feedback.textContent = "";
        }, 2800);
    }

    shareButton?.addEventListener("click", async () => {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(inviteText);
            }

            showFeedback("Convite copiado para a area de transferencia.");
        } catch {
            showFeedback("Convite pronto: compartilhe o ClimaFy com seus vizinhos.");
        }
    });
});
