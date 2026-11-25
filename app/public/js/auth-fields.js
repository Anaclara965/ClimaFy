(() => {
  const requisitosSenha = [
    { id: "len", label: "Mínimo 8 caracteres", teste: valor => valor.length >= 8 },
    { id: "upper", label: "Pelo menos uma letra maiúscula", teste: valor => /[A-Z]/.test(valor) },
    { id: "lower", label: "Pelo menos uma letra minúscula", teste: valor => /[a-z]/.test(valor) },
    { id: "number", label: "Pelo menos um número", teste: valor => /[0-9]/.test(valor) },
    { id: "symbol", label: "Pelo menos um símbolo (!@#$%)", teste: valor => /[^A-Za-z0-9]/.test(valor) },
  ];
  const faltando = valor => requisitosSenha.filter(item => !item.teste(valor));
  const tamanhoEmBytes = valor => new TextEncoder().encode(valor).length;

  function marcarValidade(campo) {
    const invalido = !campo.validity.valid;
    campo.classList.toggle("is-invalid", invalido);
    if (invalido) campo.setAttribute("aria-invalid", "true");
    else campo.removeAttribute("aria-invalid");
  }

  function mensagemSenha(campo) {
    const valor = campo.value;
    if (!valor) return "";
    if (valor.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
    if (tamanhoEmBytes(valor) > 72) return "A senha é longa demais. Reduza o tamanho e tente novamente.";
    if (faltando(valor).length) return "A senha deve conter maiúscula, minúscula, número e símbolo.";
    return "";
  }

  function atualizarFeedback(form, campo, mensagem, sucesso = false) {
    const feedback = [...form.querySelectorAll("[data-auth-feedback]")]
      .find(item => item.dataset.feedbackFor === campo.id);
    if (!feedback) return;
    feedback.textContent = mensagem;
    feedback.classList.toggle("is-error", Boolean(mensagem) && !sucesso);
    feedback.classList.toggle("is-success", sucesso);
  }

  function atualizarForm(form) {
    form.querySelectorAll('input[type="email"]').forEach(campo => {
      campo.value = campo.value.trim().toLowerCase();
    });

    form.querySelectorAll("[data-password-policy]").forEach(campo => {
      const mensagem = mensagemSenha(campo);
      campo.setCustomValidity(mensagem);
      atualizarFeedback(form, campo, mensagem);
    });

    form.querySelectorAll("[data-confirm-for]").forEach(campo => {
      const original = document.getElementById(campo.dataset.confirmFor);
      const mensagem = campo.value && original && campo.value !== original.value
        ? "As senhas não coincidem."
        : "";
      campo.setCustomValidity(mensagem);
      atualizarFeedback(form, campo, mensagem || (campo.value ? "As senhas coincidem." : ""), !mensagem && Boolean(campo.value));
    });
  }

  document.querySelectorAll("form").forEach(form => {
    form.querySelectorAll('input[type="email"]').forEach(campo => {
      campo.addEventListener("blur", () => {
        campo.value = campo.value.trim().toLowerCase();
        marcarValidade(campo);
      });
    });
    form.querySelectorAll("[data-password-policy], [data-confirm-for]").forEach(campo => {
      campo.addEventListener("blur", () => {
        atualizarForm(form);
        marcarValidade(campo);
      });
    });

    form.addEventListener("invalid", evento => {
      evento.target.classList.add("is-invalid");
      evento.target.setAttribute("aria-invalid", "true");
    }, true);
    form.addEventListener("input", evento => {
      if (evento.target.matches("[data-password-policy]") || evento.target.matches("[data-confirm-for]")) {
        atualizarForm(form);
      }
      if (evento.target.classList.contains("is-invalid")) marcarValidade(evento.target);
    });
    form.addEventListener("change", evento => {
      if (evento.target.classList.contains("is-invalid")) marcarValidade(evento.target);
    });
    form.addEventListener("submit", evento => {
      atualizarForm(form);
      if (!form.checkValidity()) {
        evento.preventDefault();
        form.reportValidity();
      }
    });
  });

  document.querySelectorAll(".password-toggle").forEach(botao => {
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

  window.ClimaFyAuthFields = { requisitosSenha, faltandoSenha: faltando };
})();
