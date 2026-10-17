(() => {
  const body = document.querySelector('#area-table-body'), feedback = document.querySelector('#users-feedback');
  const busca = document.querySelector('#area-search'), filtro = document.querySelector('#area-status');
  const fmt = new Intl.NumberFormat('pt-BR');
  const rotulos = { ativo: 'Ativo', bloqueado: 'Bloqueado', inativo: 'Inativo', pendente: 'Pendente' };
  const papeis = { cidadao: 'Cidadão', moderador: 'Moderador', administrador: 'Administrador' };
  let pagina = 1, versao = 0, timer, consulta, csrfToken, enviando = false;
  function el(tag, texto, classe) {
    const item = document.createElement(tag);
    if (texto !== undefined) item.textContent = texto;
    if (classe) item.className = classe;
    return item;
  }
  function mensagem(texto) { feedback.replaceChildren(el('span', texto)); }
  function resumo(r) {
    for (const [id, valor] of [['users-total', r.total], ['users-active', r.ativos], ['users-week', r.novosSemana], ['users-blocked', r.bloqueados]]) document.getElementById(id).textContent = fmt.format(valor);
    const parte = valor => (r.total ? 100 * valor / r.total : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% da base';
    document.querySelector('#users-month').textContent = fmt.format(r.novosMes) + ' neste mês';
    document.querySelector('#users-previous-week').textContent = fmt.format(r.novosSemanaAnterior) + ' na semana anterior';
    document.querySelector('#users-active-share').textContent = parte(r.ativos);
    document.querySelector('#users-blocked-share').textContent = parte(r.bloqueados);
  }
  function linha(u) {
    const tr = el('tr'), nome = el('td'), identificador = el('td', u.publicId); identificador.title = u.publicId;
    nome.append(el('strong', u.nome + ' ' + u.sobrenome, 'cell-title'), el('span', u.email, 'cell-subtitle'));
    const estado = u.status === 'ativo' && !u.emailVerificado ? 'pendente' : u.status;
    const status = el('span', rotulos[estado] || estado, 'status-pill');
    const cores = { ativo: ['#e0f5e9', '#147a43'], bloqueado: ['#ffe0e0', '#d62727'], pendente: ['#fff6d6', '#8a6500'] };
    const [fundo, cor] = cores[estado] || ['#eff3f5', '#48525f'];
    status.style.setProperty('--pill-bg', fundo); status.style.setProperty('--pill-color', cor);
    const colunaStatus = el('td'); colunaStatus.append(status);
    const acoes = el('section', undefined, 'table-actions');
    const perfil = el('button', 'Ver perfil', 'view-action'); perfil.type = 'button'; perfil.disabled = true;
    perfil.title = 'Gerenciamento de perfil ainda não disponível neste painel';
    const alterar = el('button', u.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear', 'toggle-action');
    alterar.type = 'button'; alterar.disabled = !u.podeAlterarStatus || enviando;
    if (!u.podeAlterarStatus) alterar.title = 'Conta de administrador ou inativa protegida contra esta ação';
    alterar.addEventListener('click', () => mudarStatus(u));
    acoes.append(perfil, alterar); const colunaAcoes = el('td'); colunaAcoes.append(acoes);
    tr.append(identificador, nome, el('td', papeis[u.papel] || u.papel),
      el('td', new Date(u.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })),
      el('td', fmt.format(u.relatos)), colunaStatus, colunaAcoes); return tr;
  }
  function paginas(p) {
    const nav = document.querySelector('#users-pagination'); nav.replaceChildren();
    const anterior = el('button', '← Anterior', 'view-action'), proxima = el('button', 'Próxima →', 'view-action');
    anterior.type = proxima.type = 'button'; anterior.disabled = p.pagina <= 1 || enviando; proxima.disabled = p.pagina >= p.paginas || enviando;
    anterior.addEventListener('click', () => { if (!enviando) { pagina--; carregar(); } });
    proxima.addEventListener('click', () => { if (!enviando) { pagina++; carregar(); } });
    nav.append(anterior, el('span', ' Página ' + (p.paginas ? p.pagina : 0) + ' de ' + p.paginas + ' '), proxima);
  }
  function validar(d) {
    return Array.isArray(d.usuarios) && d.usuarios.every(u => typeof u.publicId === 'string' && typeof u.nome === 'string' &&
      typeof u.sobrenome === 'string' && typeof u.email === 'string' && typeof u.podeAlterarStatus === 'boolean' &&
      typeof u.emailVerificado === 'boolean' && Number.isInteger(u.relatos) && u.relatos >= 0) &&
      d.resumo && ['total', 'ativos', 'bloqueados', 'novosMes', 'novosSemana', 'novosSemanaAnterior'].every(k => Number.isInteger(d.resumo[k]) && d.resumo[k] >= 0) &&
      d.paginacao && ['pagina', 'limite', 'total', 'paginas'].every(k => Number.isInteger(d.paginacao[k]) && d.paginacao[k] >= (k === 'pagina' || k === 'limite' ? 1 : 0)) &&
      typeof d.csrfToken === 'string' && /^[a-f0-9]{64}$/.test(d.csrfToken);
  }
  async function carregar() {
    const chamada = ++versao; consulta?.abort(); consulta = new AbortController();
    csrfToken = null; mensagem('Carregando usuários…'); body.setAttribute('aria-busy', 'true');
    body.replaceChildren(); document.querySelector('#users-pagination').replaceChildren();
    document.querySelector('#empty-state').classList.remove('visible');
    try {
      const q = new URLSearchParams({ pagina: String(pagina), busca: busca.value.trim() });
      const status = { Ativo: 'ativo', Pendente: 'pendente', Bloqueado: 'bloqueado', Inativo: 'inativo' }[filtro.value];
      if (status) q.set('status', status);
      const resposta = await fetch('/api/adm/usuarios?' + q, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: consulta.signal });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível consultar usuários.');
      if (!validar(dados)) throw new Error('Resposta inválida ao consultar usuários.');
      if (chamada !== versao) return;
      const ultimaPagina = Math.max(1, dados.paginacao.paginas);
      if (pagina > ultimaPagina) { pagina = ultimaPagina; return carregar(); }
      csrfToken = dados.csrfToken; resumo(dados.resumo); body.replaceChildren(...dados.usuarios.map(linha));
      document.querySelector('#empty-state').classList.toggle('visible', dados.usuarios.length === 0);
      document.querySelector('#area-count').textContent = fmt.format(dados.paginacao.total) + ' usuários neste filtro';
      paginas(dados.paginacao); mensagem('Dados do banco. Contas pendentes ainda precisam confirmar o e-mail.');
    } catch (erro) {
      if (chamada !== versao || erro.name === 'AbortError') return;
      body.replaceChildren(); mensagem(erro.message); document.querySelector('#area-count').textContent = 'Consulta indisponível';
      for (const id of ['users-total', 'users-active', 'users-week', 'users-blocked']) document.getElementById(id).textContent = '—';
      for (const id of ['users-month', 'users-previous-week', 'users-active-share', 'users-blocked-share']) document.getElementById(id).textContent = 'Consulta indisponível';
      const repetir = el('button', 'Tentar novamente', 'view-action'); repetir.type = 'button'; repetir.addEventListener('click', carregar); feedback.append(repetir);
    } finally { if (chamada === versao) body.setAttribute('aria-busy', 'false'); }
  }
  async function mudarStatus(u) {
    if (enviando || !csrfToken || !u.podeAlterarStatus) return;
    const status = u.status === 'bloqueado' ? 'ativo' : 'bloqueado';
    if (!window.confirm((status === 'bloqueado' ? 'Bloquear' : 'Desbloquear') + ' a conta de ' + u.nome + '?')) return;
    enviando = true; ++versao; clearTimeout(timer); consulta?.abort();
    const controles = [...document.querySelectorAll('button, input, select')];
    const anteriores = controles.map(c => c.disabled); controles.forEach(c => c.disabled = true);
    mensagem('Salvando alteração…'); let aviso;
    try {
      const resposta = await fetch('/api/adm/usuarios/' + encodeURIComponent(u.publicId) + '/status', {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ status, statusAnterior: u.status }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível salvar o status.');
      if (dados.ok !== true || dados.publicId !== u.publicId || dados.status !== status) throw new Error('Alteração não confirmada pelo servidor.');
      aviso = dados.mensagem;
    } catch (erro) { aviso = erro.message + ' Confira o status atualizado antes de repetir.'; }
    finally {
      controles.forEach((c, indice) => c.disabled = anteriores[indice]); enviando = false;
      await carregar(); feedback.append(el('span', ' ' + aviso));
    }
  }
  busca.addEventListener('input', () => {
    if (enviando) return; ++versao; consulta?.abort(); clearTimeout(timer); pagina = 1; timer = setTimeout(carregar, 300);
  });
  filtro.addEventListener('change', () => { if (!enviando) { pagina = 1; clearTimeout(timer); carregar(); } });
  carregar();
})();
