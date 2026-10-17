document.addEventListener("DOMContentLoaded", () => {
  const { el, json, data, paginas, rotulos } = window.ClimaFyRelatos;
  const feedback = document.querySelector("#moderation-feedback");
  const body = document.querySelector("#review-body");
  const modal = document.querySelector("#reject-modal");
  const form = document.querySelector("#reject-form");
  const reason = document.querySelector("#reject-reason");
  const note = document.querySelector("#reject-note");
  let decisao = "pendente", pagina = 1, versao = 0, timer, csrfToken, escolhido, enviando = false;
  const filtroInicial = new URLSearchParams(location.search).get("decisao");
  if (["todos", "pendente", "aprovado", "rejeitado", "solicitado_ajuste"].includes(filtroInicial)) decisao = filtroInicial;
  const tabs = [["Todos", "total", "todos"], ["Pendentes", "pendentes", "pendente"],
    ["Aprovados", "aprovados", "aprovado"], ["Rejeitados", "rejeitados", "rejeitado"], ["Ajustes", "ajuste", "solicitado_ajuste"]];
  function render(dados) {
    const menu = document.querySelector("#status-tabs"); menu.replaceChildren();
    for (const [nome, contador, filtro] of tabs) {
      const li = el("li"); const btn = el("button", nome + " (" + dados.resumo[contador] + ")");
      btn.type = "button"; btn.classList.toggle("active", decisao === filtro);
      btn.setAttribute("aria-pressed", String(decisao === filtro));
      btn.addEventListener("click", () => { if (!enviando) { decisao = filtro; pagina = 1; carregar(); } });
      li.append(btn); menu.append(li);
    }
    const stats = document.querySelector("#moderation-stats"); stats.replaceChildren();
    for (const [nome, contador] of tabs.slice(1)) {
      const secao = el("section"); secao.append(el("dd", dados.resumo[contador]), el("dt", nome)); stats.append(secao);
    }
    reason.replaceChildren(el("option", "Selecione um motivo")); reason.firstChild.value = "";
    dados.motivos.forEach(m => { const op = el("option", m.titulo); op.value = m.codigo; reason.append(op); });
    body.replaceChildren();
    for (const r of dados.relatos) {
      const tr = el("tr"); const td = el("td"); const artigo = el("article");
      artigo.append(el("h3", r.titulo, "report-title"), el("p", r.descricao, "report-desc"),
        el("p", rotulos[r.moderacao] || r.moderacao)); td.append(artigo); tr.append(td);
      tr.append(el("td", r.categoria), el("td", r.bairro + " — " + r.cidade), el("td", r.autor), el("td", data(r.criadoEm)));
      const anexos = el("td"); const verAnexos = el("a", "Consultar anexos");
      verAnexos.href = "/adm/moderacao/" + encodeURIComponent(r.publicId) + "#detail-media";
      anexos.append(verAnexos); tr.append(anexos);
      const local = el("td"); const mapa = el("a", "Ver no mapa", "location-link");
      mapa.href = "/adm/moderacao/" + encodeURIComponent(r.publicId) + "#detail-map"; local.append(mapa); tr.append(local);
      const acoes = el("td"); const section = el("section", undefined, "review-actions");
      for (const [titulo, valor, classe] of [["Aprovar", "aprovado", "approve"], ["Negar", "rejeitado", "reject"], ["Pedir ajuste", "solicitado_ajuste", "details"]]) {
        const btn = el("button", titulo, classe); btn.type = "button";
        btn.disabled = r.moderacao === valor;
        btn.addEventListener("click", () => {
          if (enviando) return;
          if (valor === "aprovado") salvar(r, valor);
          else { escolhido = { relato: r, decisao: valor }; reason.value = ""; note.value = "";
            document.querySelector("#reject-title").textContent = valor === "rejeitado" ? "Justificativa para rejeição" : "Solicitar ajuste";
            modal.showModal(); reason.focus(); }
        }); section.append(btn);
      }
      const link = el("a", "Detalhes"); link.href = "/adm/moderacao/" + encodeURIComponent(r.publicId);
      section.append(link); acoes.append(section); tr.append(acoes); body.append(tr);
    }
    const p = dados.paginacao;
    document.querySelector("#pagination-summary").textContent = p.total + " relatos neste filtro";
    paginas(document.querySelector("#moderation-pagination"), p, nova => { if (!enviando) { pagina = nova; carregar(); } });
  }
  async function carregar() {
    const chamada = ++versao; feedback.textContent = "Carregando fila…";
    const q = new URLSearchParams({ pagina, decisao, ordem: document.querySelector("#moderation-sort").value,
      busca: document.querySelector("#moderation-search").value.trim() });
    try {
      const dados = await json("/api/adm/relatos?" + q);
      if (chamada !== versao) return;
      csrfToken = dados.csrfToken; render(dados);
      feedback.textContent = dados.relatos.length ? "" : "Nenhum relato neste filtro.";
    } catch (erro) { if (chamada === versao) { body.replaceChildren(); feedback.textContent = erro.message; } }
  }
  async function salvar(relato, novaDecisao) {
    if (enviando) return;
    const motivo = novaDecisao === "aprovado" ? undefined : reason.value;
    const observacao = novaDecisao === "aprovado" ? undefined : note.value;
    enviando = true; ++versao; clearTimeout(timer);
    const controles = [...document.querySelectorAll("button, input, select, textarea")];
    const anteriores = controles.map(c => c.disabled); controles.forEach(c => c.disabled = true);
    let mensagem;
    try {
      const dados = await json("/api/adm/relatos/" + encodeURIComponent(relato.publicId) + "/moderacao", {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ decisao: novaDecisao, revisao: relato.revisao, versao: relato.versao, motivo, observacao }),
      });
      mensagem = dados.mensagem; modal.close(); escolhido = null;
    } catch (erro) {
      mensagem = erro.message + " Confira a fila antes de repetir a ação.";
      modal.close(); escolhido = null;
    }
    finally {
      controles.forEach((c, i) => c.disabled = anteriores[i]); enviando = false;
      await carregar(); feedback.textContent = mensagem;
    }
  }
  form.addEventListener("submit", event => {
    event.preventDefault(); if (escolhido && form.reportValidity()) salvar(escolhido.relato, escolhido.decisao);
  });
  modal.addEventListener("cancel", event => { if (enviando) event.preventDefault(); });
  document.querySelector("#reject-cancel").addEventListener("click", () => { if (!enviando) { escolhido = null; modal.close(); } });
  document.querySelector("#moderation-search").addEventListener("input", () => {
    if (enviando) return; ++versao; clearTimeout(timer); timer = setTimeout(() => { pagina = 1; carregar(); }, 350);
  });
  document.querySelector("#moderation-sort").addEventListener("change", () => { pagina = 1; carregar(); });
  document.querySelector("#reload-moderation").addEventListener("click", carregar);
  carregar();
});
