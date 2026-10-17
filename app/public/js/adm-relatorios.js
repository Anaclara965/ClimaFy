(() => {
  const form = document.querySelector('#report-export-form'), feedback = document.querySelector('#export-feedback');
  const botao = document.querySelector('#export-reports'), categoria = document.querySelector('#export-category');
  const bairro = document.querySelector('#export-neighborhood'), periodo = document.querySelector('#export-period'), status = document.querySelector('#export-status');
  let carregando = false, pronto = false, enviando = false;
  const controles = [botao, categoria, bairro, periodo, status];
  function mensagem(texto) { feedback.textContent = texto; }
  function habilitar(ativo) { controles.forEach(c => c.disabled = !ativo); }
  function opcao(valor, texto) { const item = document.createElement('option'); item.value = valor; item.textContent = texto; return item; }
  async function carregar() {
    if (carregando) return; carregando = true; pronto = false; habilitar(false); mensagem('Carregando filtros do banco…');
    try {
      const resposta = await fetch('/api/adm/relatorios/filtros', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível carregar os filtros.');
      if (!Array.isArray(dados.categorias) || !Array.isArray(dados.bairros) || dados.limite !== 5000 ||
        !dados.categorias.every(c => typeof c.slug === 'string' && typeof c.nome === 'string') ||
        !dados.bairros.every(b => Number.isSafeInteger(b.id) && b.id > 0 && typeof b.nome === 'string' && typeof b.cidade === 'string')) throw new Error('Resposta inválida ao consultar filtros.');
      categoria.replaceChildren(opcao('', 'Todas as categorias'), ...dados.categorias.map(c => opcao(c.slug, c.nome)));
      bairro.replaceChildren(opcao('', 'Todos os bairros'), ...dados.bairros.map(b => opcao(String(b.id), b.nome + ' — ' + b.cidade)));
      pronto = true; habilitar(true); mensagem('CSV com até 5.000 relatos. Inclui registros em moderação, sem dados cadastrais dos autores.');
    } catch (erro) {
      mensagem(erro.message); const repetir = document.createElement('button'); repetir.type = 'button'; repetir.textContent = 'Tentar novamente';
      repetir.addEventListener('click', carregar); feedback.append(repetir);
    } finally { carregando = false; }
  }
  form.addEventListener('submit', async evento => {
    evento.preventDefault(); if (!pronto || enviando) return;
    enviando = true; habilitar(false); mensagem('Preparando arquivo com os filtros selecionados…');
    try {
      const query = new URLSearchParams({ dias: periodo.value, categoria: categoria.value, bairro: bairro.value, status: status.value });
      const resposta = await fetch('/api/adm/relatorios/relatos.csv?' + query, { credentials: 'same-origin', headers: { Accept: 'text/csv, application/json' } });
      if (!resposta.ok) { const erro = await resposta.json(); throw new Error(erro.erro || 'Não foi possível gerar o relatório.'); }
      if (!/^text\/csv(?:;|$)/i.test(resposta.headers.get('content-type') || '')) throw new Error('O servidor não retornou um arquivo CSV.');
      const total = resposta.headers.get('X-Relatos-Total'), geradoEm = resposta.headers.get('X-Gerado-Em');
      if (!/^\d+$/.test(total ?? '') || Number(total) > 5000 || !geradoEm || Number.isNaN(Date.parse(geradoEm))) throw new Error('Metadados de exportação inválidos.');
      const blob = await resposta.blob();
      if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error('Tamanho de arquivo inesperado.');
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'climafy-relatos-' + geradoEm.slice(0, 10) + '.csv'; document.body.append(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
      const horario = new Date(geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      document.querySelector('#export-last-time').textContent = horario;
      mensagem('Arquivo preparado com ' + Number(total).toLocaleString('pt-BR') + ' relatos. Download solicitado ao navegador.' + (Number(total) === 0 ? ' Não há registros para esses filtros; o arquivo contém somente o cabeçalho.' : ''));
    } catch (erro) { mensagem(erro.message || 'Falha ao preparar o relatório.'); }
    finally { enviando = false; habilitar(pronto); }
  });
  carregar();
})();
