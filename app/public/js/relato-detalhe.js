document.addEventListener("DOMContentLoaded", () => {
  const { json, rotulos } = window.ClimaFyRelatos;
  const anexos = document.querySelector("#detail-media");
  if (anexos && window.ClimaFyMidias) window.ClimaFyMidias.carregarAnexos(anexos);
  const alvo = document.querySelector("#detail-map");
  if (window.L) {
    const ponto = [Number(alvo.dataset.latitude), Number(alvo.dataset.longitude)];
    const mapa = L.map(alvo, { scrollWheelZoom: false }).setView(ponto, 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(mapa);
    L.marker(ponto).addTo(mapa);
  } else alvo.textContent = "Mapa indisponível. Use o link abaixo para consultar o ponto.";
  const principal = document.querySelector(".report-detail");
  const excluir = document.querySelector("#delete-report");
  if (excluir) excluir.addEventListener("click", async () => {
    if (excluir.disabled || !window.confirm("Excluir este relato da exibição? O histórico será preservado.")) return;
    const feedback = document.querySelector("#author-feedback");
    excluir.disabled = true; feedback.textContent = "Excluindo…";
    try {
      const dados = await json("/api/meus-relatos/" + encodeURIComponent(principal.dataset.publicId), {
        method: "DELETE", headers: { "Content-Type": "application/json", "X-CSRF-Token": principal.dataset.csrf },
        body: JSON.stringify({ versao: principal.dataset.versao }),
      });
      if (dados.ok !== true || dados.excluido !== true) throw new Error("Exclusão não confirmada.");
      window.location.assign("/meus-relatos");
    } catch (erro) {
      feedback.textContent = erro.message + " Confira Meus relatos antes de repetir; não confirmamos a exclusão.";
      excluir.disabled = false;
    }
  });
  const form = document.querySelector("#situation-form");
  if (!form) return;
  const feedback = document.querySelector("#situation-feedback");
  let enviando = false;
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (enviando || !form.reportValidity()) return;
    const status = document.querySelector("#situation").value;
    const observacao = document.querySelector("#situation-note").value;
    enviando = true; [...form.elements].forEach(item => item.disabled = true);
    feedback.textContent = "Salvando…";
    try {
      const dados = await json("/api/adm/relatos/" + encodeURIComponent(principal.dataset.publicId) + "/situacao", {
        method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": principal.dataset.csrf },
        body: JSON.stringify({ status, statusAnterior: form.dataset.currentStatus, versao: principal.dataset.versao, observacao }),
      });
      form.dataset.currentStatus = status; document.querySelector("#detail-status").textContent = rotulos[status];
      feedback.textContent = dados.mensagem;
    } catch (erro) { feedback.textContent = erro.message + " Atualize a página para conferir antes de repetir."; }
    finally { enviando = false; [...form.elements].forEach(item => item.disabled = false); }
  });
});
