document.addEventListener("DOMContentLoaded", () => {
    const senha = document.getElementById("senha");
    const confirmaSenha = document.getElementById("confirma-senha");

    // Validação extra para verificar se as senhas coincidem (usando a API nativa do HTML5)
    function validarSenha() {
        if (senha.value !== confirmaSenha.value) {
            confirmaSenha.setCustomValidity("As senhas não coincidem.");
        } else {
            // Limpa o erro customizado, permitindo que o formulário seja enviado
            confirmaSenha.setCustomValidity("");
        }
    }

    // Escuta eventos de digitação para validar em tempo real
    senha.addEventListener("input", validarSenha);
    confirmaSenha.addEventListener("input", validarSenha);

});
