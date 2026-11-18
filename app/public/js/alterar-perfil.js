(() => {
  const input = document.querySelector("#profile-photo");
  const form = document.querySelector(".photo-upload-form");
  const feedback = document.querySelector("#photo-feedback");
  if (!input || !form || !feedback) return;

  let previewUrl = null;
  const frames = [...document.querySelectorAll(".profile-avatar-frame")];

  function arquivoValido(arquivo) {
    if (!arquivo) {
      input.setCustomValidity("");
      return false;
    }
    if (!["image/jpeg", "image/png"].includes(arquivo.type)) {
      input.setCustomValidity("Escolha uma imagem JPEG ou PNG.");
      feedback.textContent = "Escolha uma imagem JPEG ou PNG.";
      return false;
    }
    if (arquivo.size === 0 || arquivo.size > 5 * 1024 * 1024) {
      input.setCustomValidity("A imagem deve ter até 5 MB.");
      feedback.textContent = "A imagem deve ter até 5 MB.";
      return false;
    }
    input.setCustomValidity("");
    return true;
  }

  input.addEventListener("change", () => {
    const arquivo = input.files?.[0];
    if (!arquivo || !arquivoValido(arquivo)) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(arquivo);
    for (const frame of frames) {
      const imagem = document.createElement("img");
      imagem.className = "profile-avatar" + (frame.classList.contains("profile-avatar-frame--large") ? " profile-avatar-large" : "");
      imagem.alt = frame.classList.contains("profile-avatar-frame--large") ? "Pré-visualização da foto de perfil" : "Foto de perfil";
      imagem.src = previewUrl;
      frame.replaceChildren(imagem);
    }
    feedback.textContent = "Pré-visualização atualizada. Envie a foto para salvá-la.";
  });

  form.addEventListener("submit", evento => {
    if (arquivoValido(input.files?.[0])) return;
    evento.preventDefault();
    input.reportValidity();
  });
})();
