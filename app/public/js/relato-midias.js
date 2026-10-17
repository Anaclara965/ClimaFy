// Integração dos anexos nas telas existentes. Nunca recebe chaves do Cloudinary.
(function () {
  const tipos = ["image/jpeg", "image/png", "video/mp4", "video/webm"];
  const maxBytes = 5242880;

  function configurarEnvio({ form, input, zona, feedback, remover, titulo, ajuda, previa, edicao }) {
    let arquivo = null;
    let urlPrevia = null;
    let csrf = "";
    let disponivel = false;
    input.disabled = true;
    function atualizar() {
      input.disabled = Boolean(edicao) || !disponivel || form.getAttribute("aria-busy") === "true";
    }
    function limparPrevia() {
      if (urlPrevia) { window.URL.revokeObjectURL(urlPrevia); urlPrevia = null; }
      if (previa) { previa.replaceChildren(); previa.hidden = true; }
    }
    function mostrarPrevia() {
      limparPrevia();
      if (!previa || !arquivo?.type.startsWith("image/") || !window.URL?.createObjectURL) return;
      const endereco = window.URL.createObjectURL(arquivo);
      urlPrevia = endereco;
      const imagem = document.createElement("img");
      imagem.alt = "Prévia da foto selecionada para este relato";
      imagem.width = 160; imagem.height = 160;
      imagem.style.maxWidth = "100%"; imagem.style.objectFit = "contain";
      const legenda = document.createElement("figcaption");
      legenda.textContent = arquivo.name;
      imagem.addEventListener("error", () => {
        // Uma imagem anterior pode falhar depois que outra já foi selecionada.
        if (urlPrevia !== endereco) return;
        limpar();
        const mensagem = "Não foi possível abrir esta imagem. Selecione outra foto ou remova o arquivo.";
        feedback.textContent = mensagem; input.setCustomValidity(mensagem);
        if (remover) remover.hidden = false;
      });
      imagem.src = endereco;
      previa.replaceChildren(imagem, legenda); previa.hidden = false;
    }
    function limpar() {
      limparPrevia();
      arquivo = null; input.value = ""; input.setCustomValidity("");
      if (remover) remover.hidden = true;
      feedback.textContent = "Nenhum arquivo selecionado.";
    }
    function selecionar(arquivos) {
      if (input.disabled) return;
      limpar();
      if (!arquivos.length) return;
      const escolhido = arquivos[0];
      if (arquivos.length !== 1 || !tipos.includes(escolhido.type) || !escolhido.size || escolhido.size > maxBytes) {
        const mensagem = "Selecione um único arquivo JPEG, PNG, MP4 ou WebM não vazio de até 5 MB.";
        feedback.textContent = mensagem; input.setCustomValidity(mensagem);
        if (remover) remover.hidden = false;
        return;
      }
      arquivo = escolhido;
      mostrarPrevia();
      feedback.textContent = `Arquivo selecionado: ${arquivo.name}. Vídeos devem ter até 30 segundos.`;
      if (remover) remover.hidden = false;
    }
    input.addEventListener("change", () => selecionar(Array.from(input.files)));
    zona.addEventListener("drop", event => {
      event.preventDefault();
      if (input.disabled) {
        feedback.textContent = edicao ? "A troca de anexos não está disponível na edição. Os anexos existentes serão mantidos."
          : "Envio de anexos indisponível no momento. Você pode enviar o relato sem arquivo.";
        return;
      }
      selecionar(Array.from(event.dataTransfer?.files ?? []));
    });
    if (remover) remover.addEventListener("click", () => { if (!input.disabled) limpar(); });
    window.addEventListener?.("pagehide", limparPrevia);
    window.addEventListener?.("pageshow", event => { if (event.persisted && arquivo) mostrarPrevia(); });

    const pronto = (async () => {
      if (edicao) {
        if (titulo) titulo.textContent = "Anexos existentes serão mantidos";
        if (ajuda) ajuda.textContent = "A troca de foto/vídeo não está disponível na edição.";
        return;
      }
      try {
        const res = await fetch("/api/relatos/envio/configuracao", {
          credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store",
        });
        const dados = await res.json();
        if (!res.ok || !/^[a-f0-9]{64}$/.test(dados.csrfToken) || dados.anexos?.disponivel !== true) throw new Error("Indisponível");
        csrf = dados.csrfToken; disponivel = true;
        if (titulo) titulo.textContent = "Selecione ou arraste uma foto ou vídeo";
        feedback.textContent = "Anexo opcional. JPEG/PNG ou MP4/WebM, até 5 MB; vídeo até 30 segundos.";
      } catch {
        if (titulo) titulo.textContent = "Anexos indisponíveis no momento";
        feedback.textContent = "Você pode enviar sem arquivo. Para tentar anexar novamente, recarregue a página.";
      } finally { atualizar(); }
    })();

    function preparar(dados) {
      if (!arquivo) return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) };
      if (edicao || !disponivel || !csrf) throw new Error("O envio deste anexo não está disponível. Atualize a página.");
      const body = new FormData();
      Object.entries(dados).forEach(([nome, valor]) => body.set(nome, valor));
      body.set("foto", arquivo);
      // O navegador define Content-Type e boundary do multipart, não o aplicativo.
      return { headers: { "X-CSRF-Token": csrf }, body };
    }
    return { pronto, preparar, atualizar };
  }

  async function carregarAnexos(secao) {
    const feedback = secao.querySelector("[data-midia-feedback]");
    const lista = secao.querySelector("[data-midia-lista]");
    const base = secao.dataset.midiasUrl;
    lista.replaceChildren(); feedback.textContent = "Carregando anexos…";
    try {
      if (!/^\/api\/(?:relatos|meus-relatos|adm\/relatos)\/[a-f0-9-]{36}\/midias$/i.test(base)) throw new Error("Endereço de anexos inválido.");
      const res = await fetch(base, { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
      const dados = await res.json();
      if (!res.ok || !Array.isArray(dados.midias) || dados.midias.length > 10) throw new Error("Consulta de anexos indisponível.");
      const figuras = dados.midias.map((m, indice) => {
        const foto = m.tipo === "foto" && ["image/jpeg", "image/png"].includes(m.mimeType);
        const video = m.tipo === "video" && ["video/mp4", "video/webm"].includes(m.mimeType);
        if ((!foto && !video) || !/^[1-9][0-9]{0,19}$/.test(m.id) || m.url !== base + "/" + m.id ||
            !Number.isInteger(m.tamanhoBytes) || m.tamanhoBytes < 1 || m.tamanhoBytes > maxBytes) throw new Error("Resposta de anexo inválida.");
        const figura = document.createElement("figure");
        const media = document.createElement(foto ? "img" : "video");
        media.style.maxWidth = "100%"; media.style.height = "auto";
        if (foto) { media.alt = "Foto anexada pelo autor ao relato. Consulte a descrição para contexto."; media.loading = "lazy"; }
        else { media.controls = true; media.preload = "none"; media.setAttribute("playsinline", ""); }
        const legenda = document.createElement("figcaption");
        legenda.textContent = `${foto ? "Foto" : "Vídeo"} ${indice + 1} do relato. `;
        media.addEventListener("error", () => { legenda.textContent = "Não foi possível carregar este anexo. Recarregue a página para tentar novamente."; });
        media.src = m.url;
        const link = document.createElement("a");
        link.href = m.url; link.textContent = "Abrir arquivo"; link.target = "_blank"; link.rel = "noopener noreferrer";
        legenda.appendChild(link); figura.appendChild(media); figura.appendChild(legenda);
        return figura;
      });
      lista.replaceChildren(...figuras);
      feedback.textContent = figuras.length ? "" : "Este relato não tem anexos.";
    } catch {
      lista.replaceChildren();
      feedback.textContent = "Não foi possível consultar os anexos. Recarregue a página antes de concluir a revisão deste relato.";
    }
  }
  window.ClimaFyMidias = { configurarEnvio, carregarAnexos };
})();
