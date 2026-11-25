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

});
