document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registration-form");
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

    // Evita o recarregamento na prototipagem e simula o sucesso do formulário nativo
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        
        // Se a validação nativa do HTML passar, este bloco será executado.
        if (form.checkValidity()) {
            window.location.href = "cadastro-verificacao.html";
            return;
            const nomeUsuario = document.getElementById("nome").value;
            console.log(`Cadastro realizado com sucesso para: ${nomeUsuario}`);
            
            // Simulação de redirecionamento ou próxima etapa
            // window.location.href = "home-interativo.html";
        }
    });
});