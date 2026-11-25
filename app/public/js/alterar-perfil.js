(() => {
  const input = document.querySelector("#profile-photo");
  const form = document.querySelector(".photo-upload-form");
  const feedback = document.querySelector("#photo-feedback");
  if (!input || !form || !feedback) return;

  let previewUrl = null;
  let validacaoAtual = 0;
  let validandoEnvio = false;
  let envioValidado = false;
  const frames = [...document.querySelectorAll(".profile-avatar-frame")];
  const conteudoOriginal = frames.map((frame) => ({
    frame,
    filhos: [...frame.childNodes].map((filho) => filho.cloneNode(true)),
  }));

  async function validarArquivo(arquivo) {
    if (!arquivo) {
      return "Selecione uma foto JPEG ou PNG de até 5 MB.";
    }
    if (arquivo.size === 0 || arquivo.size > 5 * 1024 * 1024) {
      return "A imagem deve ter até 5 MB.";
    }
    if (!["image/jpeg", "image/png"].includes(arquivo.type)) {
      return "Escolha uma imagem JPEG ou PNG.";
    }

    let bytes;
    try {
      bytes = new Uint8Array(await arquivo.arrayBuffer());
    } catch {
      return "Não foi possível ler a imagem selecionada.";
    }

    const png = bytes.length >= 24 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a &&
      bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52;
    const jpeg = bytes.length >= 4 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    const tipoReal = png ? "image/png" : jpeg ? "image/jpeg" : null;

    if (!tipoReal || tipoReal !== arquivo.type) {
      return "O conteúdo do arquivo não corresponde a uma imagem JPEG ou PNG válida.";
    }
    return "";
  }

  function restaurarAvatares() {
    for (const { frame, filhos } of conteudoOriginal) {
      frame.replaceChildren(...filhos.map((filho) => filho.cloneNode(true)));
    }
  }

  input.addEventListener("change", async () => {
    const validacao = ++validacaoAtual;
    const arquivo = input.files?.[0];
    input.setCustomValidity("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    restaurarAvatares();
    if (!arquivo) {
      feedback.textContent = "";
      return;
    }

    const erro = await validarArquivo(arquivo);
    if (validacao !== validacaoAtual) return;
    if (erro) {
      input.setCustomValidity(erro);
      feedback.textContent = erro;
      return;
    }

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

  form.addEventListener("submit", async (evento) => {
    if (envioValidado) {
      envioValidado = false;
      return;
    }
    evento.preventDefault();
    if (validandoEnvio) return;
    validandoEnvio = true;

    const botao = form.querySelector('button[type="submit"]');
    if (botao) botao.disabled = true;
    const erro = await validarArquivo(input.files?.[0]);
    input.setCustomValidity(erro);
    if (erro) {
      feedback.textContent = erro;
      input.reportValidity();
      validandoEnvio = false;
      if (botao) botao.disabled = false;
      return;
    }

    envioValidado = true;
    validandoEnvio = false;
    if (evento.submitter) form.requestSubmit(evento.submitter);
    else form.requestSubmit();
  });

  window.addEventListener("pagehide", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });
})();
