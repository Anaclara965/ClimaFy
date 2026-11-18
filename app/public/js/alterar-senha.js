(() => {
  const form = document.querySelector("#change-password-form");
  const senha = document.querySelector("#new-password");
  const confirmacao = document.querySelector("#confirm-password");
  if (!form || !senha || !confirmacao) return;

  function validar() {
    const valor = senha.value;
    let erro = "";
    if (valor && (!/[A-Z]/.test(valor) || !/[a-z]/.test(valor) || !/[0-9]/.test(valor) || !/[^A-Za-z0-9]/.test(valor))) {
      erro = "Use maiúscula, minúscula, número e símbolo na nova senha.";
    } else if (valor && new TextEncoder().encode(valor).length > 72) {
      erro = "A nova senha é longa demais. Reduza o tamanho e tente novamente.";
    }
    senha.setCustomValidity(erro);
    confirmacao.setCustomValidity(confirmacao.value && confirmacao.value !== valor ? "As senhas não coincidem." : "");
  }

  senha.addEventListener("input", validar);
  confirmacao.addEventListener("input", validar);
  form.addEventListener("submit", evento => {
    validar();
    if (!form.checkValidity()) {
      evento.preventDefault();
      form.reportValidity();
    }
  });
})();
