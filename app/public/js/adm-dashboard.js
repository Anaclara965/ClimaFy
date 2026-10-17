(() => {
  const feedback = document.querySelector('#dashboard-feedback'), fmt = new Intl.NumberFormat('pt-BR');
  const cores = { alagamento: '#2469d6', queimada: '#d62727', 'calor-extremo': '#f37d22', 'arvore-caida': '#63a93a', lixo: '#8b6328', 'poluicao-agua': '#16a3a3' };
  function el(tag, texto, classe) {
    const item = document.createElement(tag);
    if (texto !== undefined) item.textContent = texto;
    if (classe) item.className = classe;
    return item;
  }
  function data(valor) { return new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  function kpis(r) {
    const itens = [
      [r.relatosAtivos, 'Relatos ativos', 'Abertos ou em andamento, inclusive em moderação', '▣', '#d62727', '#ffe0e0'],
      [r.pendentes, 'Pendentes Mod.', 'Versão atual aguardando revisão', '⌛', '#f4b60d', '#fff6d6'],
      [r.aprovadosMes, 'Aprovados (mês)', 'Versão atual aprovada neste mês', 'OK', '#1a9651', '#e0f5e9'],
      [r.rejeitadosMes, 'Rejeitados (mês)', 'Versão atual rejeitada neste mês', '×', '#48525f', '#eff3f5'],
      [r.cidadesComRelatos, 'Cidades com relatos', 'Registros não excluídos', '▥', '#2469d6', '#e0efff'],
    ];
    document.querySelector('#kpi-grid').replaceChildren(...itens.map(([valor, nome, ajuda, icone, cor, suave]) => {
      const artigo = el('article', undefined, 'kpi-card'); artigo.style.setProperty('--tone', cor); artigo.style.setProperty('--tone-soft', suave);
      const lista = el('dl'), topo = el('section', undefined, 'kpi-top'), simbolo = el('dt', icone, 'kpi-icon');
      simbolo.setAttribute('aria-hidden', 'true'); topo.append(simbolo, el('dd', fmt.format(valor)));
      lista.append(topo, el('dt', nome), el('small', ajuda)); artigo.append(lista); return artigo;
    }));
    document.querySelector('#dashboard-pending').textContent = fmt.format(r.pendentes) + ' pendentes';
  }
  function fila(itens) {
    const body = document.querySelector('#moderation-body'); body.replaceChildren();
    if (!itens.length) {
      const tr = el('tr'), td = el('td', 'Nenhum relato aguardando moderação.'); td.colSpan = 5; tr.append(td); body.append(tr); return;
    }
    for (const r of itens) {
      const tr = el('tr'), categoria = el('td'), chip = el('span', r.categoria, 'category-chip');
      const cor = cores[r.categoriaSlug] || '#48525f'; chip.style.setProperty('--chip-color', cor); chip.style.setProperty('--chip-bg', cor + '1f'); categoria.append(chip);
      const acoes = el('td'), secao = el('section', undefined, 'row-actions');
      for (const [texto, classe, href] of [['Revisar', 'approve', '/adm/moderacao?decisao=pendente'],
        ['Detalhes', 'reject', '/adm/moderacao/' + encodeURIComponent(r.publicId)]]) {
        const botao = el('button', texto, classe); botao.type = 'button';
        botao.addEventListener('click', () => window.location.assign(href)); secao.append(botao);
      }
      acoes.append(secao); tr.append(el('td', r.titulo), categoria, el('td', r.bairro), el('td', data(r.criadoEm)), acoes); body.append(tr);
    }
  }
  function atividades(itens) {
    const lista = document.querySelector('#activity-list'); lista.replaceChildren();
    if (!itens.length) { lista.append(el('li', 'Nenhuma atividade registrada.')); return; }
    const rotulos = { criacao: 'Novo relato', aprovado: 'Relato aprovado', rejeitado: 'Relato rejeitado', solicitado_ajuste: 'Ajuste solicitado', cadastro: 'Novo usuário cadastrado' };
    const coresEventos = { aprovado: '#1a9651', rejeitado: '#d62727', solicitado_ajuste: '#f4b60d', criacao: '#2469d6', cadastro: '#2469d6' };
    for (const a of itens) {
      const li = el('li'), ponto = el('span', undefined, 'activity-dot'), artigo = el('article');
      ponto.style.setProperty('--dot', coresEventos[a.tipo] || '#48525f'); ponto.setAttribute('aria-hidden', 'true');
      const tempo = el('time', data(a.ocorridoEm)); tempo.dateTime = new Date(a.ocorridoEm).toISOString();
      artigo.append(el('p', (rotulos[a.tipo] || 'Atividade') + (a.titulo ? ': ' + a.titulo : '')), tempo); li.append(ponto, artigo); lista.append(li);
    }
  }
  function grafico(dados) {
    const maximo = Math.max(1, ...dados.dias.map(d => d.total));
    document.querySelector('#daily-chart').replaceChildren(...dados.dias.map((d, indice) => {
      const li = el('li'), barra = el('span'), dataDia = new Date(d.data + 'T12:00:00Z');
      const rotulo = dataDia.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const texto = rotulo + ': ' + fmt.format(d.total) + ' relatos';
      barra.style.height = Math.round(d.total / maximo * 235) + 'px'; barra.style.setProperty('--bar', indice === dados.dias.length - 1 ? '#1a9651' : '#dfe5e9');
      barra.title = texto; li.setAttribute('aria-label', texto);
      li.append(barra, el('span', String(dataDia.getUTCDate()).padStart(2, '0'))); return li;
    }));
    document.querySelector('#dashboard-period').textContent = 'Total: ' + fmt.format(dados.totalPeriodo) + ' relatos no período — horário de São Paulo';
    const total = dados.categorias.reduce((soma, c) => soma + c.total, 0);
    const categorias = document.querySelector('#category-bars'); categorias.replaceChildren();
    if (!dados.categorias.length) categorias.append(el('p', 'Nenhum relato registrado.'));
    for (const c of dados.categorias) {
      const secao = el('section', undefined, 'category-row'); secao.style.setProperty('--color', cores[c.slug] || '#48525f');
      const trilho = el('section', undefined, 'category-track'), barra = el('span', fmt.format(c.total), 'category-fill');
      const percentual = total ? 100 * c.total / total : 0; barra.style.width = percentual + '%'; trilho.append(barra);
      secao.append(el('dt', c.nome), trilho, el('dd', percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%')); categorias.append(secao);
    }
  }
  function validar(d) {
    const contador = n => Number.isInteger(n) && n >= 0;
    return d.resumo && ['relatosAtivos', 'pendentes', 'aprovadosMes', 'rejeitadosMes', 'cidadesComRelatos'].every(k => contador(d.resumo[k])) &&
      Array.isArray(d.fila) && Array.isArray(d.atividades) && Array.isArray(d.categorias) && d.categorias.every(c => contador(c.total)) &&
      Array.isArray(d.dias) && d.dias.length === 14 && d.dias.every(dia => contador(dia.total) && /^\d{4}-\d{2}-\d{2}$/.test(dia.data)) &&
      contador(d.totalPeriodo) && d.totalPeriodo === d.dias.reduce((soma, dia) => soma + dia.total, 0) &&
      !Number.isNaN(new Date(d.atualizadoEm).getTime());
  }
  async function carregar() {
    feedback.replaceChildren(el('span', 'Carregando dados administrativos…'));
    try {
      const resposta = await fetch('/api/adm/dashboard', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível consultar o dashboard.');
      if (!validar(dados)) throw new Error('Resposta inválida ao consultar o dashboard.');
      kpis(dados.resumo); fila(dados.fila); atividades(dados.atividades); grafico(dados);
      feedback.textContent = 'Dados do banco. Atualizado em ' + data(dados.atualizadoEm) + ' (São Paulo).';
    } catch (erro) {
      for (const seletor of ['#kpi-grid', '#moderation-body', '#activity-list', '#daily-chart', '#category-bars']) document.querySelector(seletor).replaceChildren();
      document.querySelector('#dashboard-pending').textContent = 'Consulta indisponível';
      document.querySelector('#dashboard-period').textContent = 'Período indisponível';
      feedback.replaceChildren(el('span', erro.message));
      const botao = el('button', 'Tentar novamente'); botao.type = 'button'; botao.addEventListener('click', carregar); feedback.append(botao);
    }
  }
  carregar();
})();
