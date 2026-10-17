// Login. O POST é tradicional (action="/login"): a página recarrega com o
// resultado do servidor. Nada de preventDefault aqui.
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) return;

    loginForm.addEventListener("submit", () => {
        const botao = loginForm.querySelector('button[type="submit"]');
        // Só muda o rótulo: desabilitar o botão dentro do submit pode cancelar
        // o envio em alguns navegadores.
        if (botao) botao.textContent = "Entrando...";
    });

    // Mostrar/ocultar senha, quando a página oferecer o botão.
    document.querySelectorAll(".password-toggle").forEach((botao) => {
        const campo = botao.parentElement?.querySelector('input[type="password"], input[type="text"]');
        if (!campo) return;

        botao.addEventListener("click", () => {
            const visivel = campo.type === "password";
            campo.type = visivel ? "text" : "password";
            const icone = botao.querySelector("i");
            if (icone) icone.className = visivel ? "ph ph-eye-slash" : "ph ph-eye";
            botao.setAttribute("aria-label", visivel ? "Ocultar senha" : "Mostrar senha");
            botao.setAttribute("aria-pressed", String(visivel));
            campo.focus({ preventScroll: true });
        });
    });
});
