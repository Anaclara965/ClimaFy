window.ClimaFyRelatos = (() => {
  const rotulos = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido",
    pendente: "Aguardando moderação", aprovado: "Aprovado", rejeitado: "Rejeitado", solicitado_ajuste: "Ajuste solicitado" };
  function el(tag, texto, classe) {
    const item = document.createElement(tag);
    if (texto !== undefined) item.textContent = texto;
    if (classe) item.className = classe;
    return item;
  }
  async function json(url, opcoes = {}) {
    const resposta = await fetch(url, { credentials: "same-origin", ...opcoes });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || dados.erros?.join(" ") || "Não foi possível concluir a operação.");
    return dados;
  }
  function data(valor) { return new Date(valor).toLocaleString("pt-BR"); }
  function card(r, prefixo = "/relatos/") {
    const artigo = el("article", undefined, "report-card");
    const conteudo = el("section", undefined, "report-card-inner");
    const meta = el("header", undefined, "card-meta");
    meta.append(el("span", r.categoria, "category-badge"), el("span", r.bairro + " — " + r.cidade, "neighborhood"));
    const footer = el("footer", undefined, "card-footer");
    footer.append(el("span", rotulos[r.status] || r.status, "status-badge " + (r.status === "resolvido" ? "status-done" : r.status === "em_andamento" ? "status-progress" : "status-open")));
    const time = el("time", data(r.criadoEm), "time"); time.dateTime = r.criadoEm;
    footer.append(time, el("span", "▲ " + r.votos, "votes"));
    const link = el("a", "Ver detalhes →", "arrow");
    link.href = prefixo + encodeURIComponent(r.publicId); link.setAttribute("aria-label", "Ver relato: " + r.titulo);
    footer.append(link);
    conteudo.append(meta, el("h3", r.titulo), el("p", r.descricao));
    if (r.moderacao) conteudo.append(el("p", rotulos[r.moderacao] || r.moderacao));
    conteudo.append(footer); artigo.append(conteudo); return artigo;
  }
  function paginas(nav, p, mudar) {
    nav.replaceChildren();
    const anterior = el("button", "← Anterior"); anterior.type = "button"; anterior.disabled = p.pagina <= 1;
    anterior.addEventListener("click", () => mudar(p.pagina - 1));
    const proxima = el("button", "Próxima →"); proxima.type = "button"; proxima.disabled = p.pagina >= p.paginas;
    proxima.addEventListener("click", () => mudar(p.pagina + 1));
    nav.append(anterior, el("span", "Página " + (p.paginas ? p.pagina : 0) + " de " + p.paginas), proxima);
  }
  return { el, json, data, card, paginas, rotulos };
})();
