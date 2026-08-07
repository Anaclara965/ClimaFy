document.addEventListener("DOMContentLoaded", () => {
    // Referências dos elementos para manipulação semântica
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const loginForm = document.getElementById("login-form");

    // Lógica simples de alternância de abas (toggles visuais)
    tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        // Aqui entraria a lógica para mostrar o formulário de login e ocultar o de cadastro
    });

    tabRegister.addEventListener("click", () => {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        // Aqui entraria a lógica para mostrar o formulário de cadastro e ocultar o de login
    });

    // Prevenção do recarregamento da página ao enviar o formulário (uso em prototipagem)
    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value;
        console.log(`Tentativa de login com o e-mail: ${email}`);

        // Aqui você integraria a lógica real de autenticação (API, etc)
    });
});