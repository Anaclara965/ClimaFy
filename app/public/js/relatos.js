let activeStatus = 'Todos';
let versaoDaBusca = 0;
let buscaEmAndamento;
const coresCategoria = {
    alagamento: '#2469d6', queimada: '#d62727', 'calor-extremo': '#f35c22',
    'arvore-caida': '#63a93a', lixo: '#8b6328', 'poluicao-agua': '#16a3a3',
};
const rotulosStatus = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };

function criarElemento(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto !== undefined) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
}

function statusClass(status) {
    if (status === 'Em andamento') return 'status-progress';
    if (status === 'Resolvido') return 'status-done';
    return 'status-open';
}

function parametrosDaLista(pagina) {
    const category = document.querySelector('#category-filter').value;
    const neighborhood = document.querySelector('#neighborhood-filter').value;
    const period = document.querySelector('#period-filter').value;
    const search = document.querySelector('#report-search').value.trim();
    const sort = document.querySelector('#sort-filter').value;

    const parametros = new URLSearchParams({ pagina: String(pagina), ordem: sort });
    const status = { Aberto: 'aberto', 'Em andamento': 'em_andamento', Resolvido: 'resolvido' }[activeStatus];
    const dias = { '24 horas': '1', '7 dias': '7', '30 dias': '30' }[period];
    if (status) parametros.set('status', status);
    if (category && !['Todas', 'Categoria'].includes(category)) parametros.set('categoria', category);
    if (neighborhood && !['Todos', 'Bairro'].includes(neighborhood)) parametros.set('bairro', neighborhood);
    if (dias) parametros.set('dias', dias);
    if (search) parametros.set('busca', search);
    return parametros;
}

// Mesma estrutura/classes do card original. Apenas a fonte dos dados muda.
function criarCard(relato, controlesVotos = []) {
    const artigo = criarElemento('article', undefined, 'report-card');
    artigo.style.setProperty('--accent', coresCategoria[relato.categoriaSlug] || '#1a9651');
    const conteudo = criarElemento('section', undefined, 'report-card-inner');
    const meta = criarElemento('header', undefined, 'card-meta');
    meta.append(criarElemento('span', relato.categoria, 'category-badge'), criarElemento('span', relato.bairro, 'neighborhood'));
    const status = rotulosStatus[relato.status] || relato.status;
    const footer = criarElemento('footer', undefined, 'card-footer');
    footer.append(criarElemento('span', status, 'status-badge ' + statusClass(status)));
    const instante = new Date(relato.criadoEm);
    const valido = !Number.isNaN(instante.getTime());
    const tempo = criarElemento('time', valido ? instante.toLocaleDateString('pt-BR') : 'Data indisponível', 'time');
    if (valido) { tempo.dateTime = instante.toISOString(); tempo.title = instante.toLocaleString('pt-BR'); }
    const link = criarElemento('a', '→', 'arrow');
    link.href = '/relatos/' + encodeURIComponent(relato.publicId);
    link.setAttribute('aria-label', 'Abrir relato ' + relato.titulo);
    const botao = criarElemento('button', '▲ ' + relato.votos, 'votes');
    botao.type = 'button'; botao.disabled = true;
    const feedback = criarElemento('p', '', 'vote-feedback');
    feedback.hidden = true; feedback.setAttribute('role', 'status');
    const controle = { publicId: relato.publicId, titulo: relato.titulo, botao, feedback,
        total: relato.votos, estado: 'carregando', enviando: false };
    controlesVotos.push(controle);
    atualizarBotaoVoto(controle);
    botao.addEventListener('click', () => acionarVoto(controle));
    footer.append(tempo, botao, link);
    // Nunca inserir titulo/descricao vindos do banco por innerHTML.
    conteudo.append(meta, criarElemento('h3', relato.titulo), criarElemento('p', relato.descricao), footer, feedback);
    artigo.append(conteudo);
    return artigo;
}

function atualizarBotaoVoto(controle) {
    const { botao, estado } = controle;
    const proprio = typeof estado === 'object' && estado.proprio;
    const votado = typeof estado === 'object' && estado.votado;
    const acao = proprio ? 'Você não pode votar no próprio relato' : estado === 'visitante'
        ? 'Entre na sua conta para votar' : estado === 'erro' ? 'Consultar voto antes de tentar novamente'
        : estado === 'indisponivel' ? 'Relato não está mais publicado' : estado === 'carregando'
        ? 'Consultando votos' : votado ? 'Retirar meu voto' : 'Votar neste relato';
    botao.textContent = '▲ ' + controle.total;
    botao.disabled = controle.enviando || proprio || ['carregando', 'indisponivel'].includes(estado);
    botao.title = acao;
    botao.setAttribute('aria-label', acao + ': ' + controle.titulo + '. ' + controle.total + ' votos.');
    botao.setAttribute('aria-pressed', String(Boolean(votado)));
    botao.setAttribute('aria-busy', String(controle.enviando || estado === 'carregando'));
}

function votoValido(voto, publicId) {
    return voto && voto.publicId === publicId && Number.isInteger(voto.votos) && voto.votos >= 0 &&
        typeof voto.votado === 'boolean' && typeof voto.proprio === 'boolean' &&
        typeof voto.podeVotar === 'boolean' && voto.podeVotar === !voto.proprio;
}

function informarVoto(controle, mensagem) {
    controle.feedback.textContent = mensagem; controle.feedback.hidden = !mensagem;
}

async function carregarVotos(controles, signal) {
    if (!controles.length) return;
    controles.forEach(controle => { controle.estado = 'carregando'; atualizarBotaoVoto(controle); });
    try {
        const resposta = await fetch('/api/votos?' + new URLSearchParams({ relatos: controles.map(c => c.publicId).join(',') }), {
            credentials: 'same-origin', headers: { Accept: 'application/json' }, signal,
        });
        if (resposta.status === 401) {
            controles.forEach(controle => { controle.estado = 'visitante'; atualizarBotaoVoto(controle); });
            return;
        }
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível consultar seus votos.');
        if (!Array.isArray(dados.votos) || typeof dados.csrfToken !== 'string' || !/^[a-f0-9]{64}$/.test(dados.csrfToken)) {
            throw new Error('Resposta inválida ao consultar os votos.');
        }
        const mapa = new Map(dados.votos.map(voto => [voto.publicId, voto]));
        if (controles.some(c => mapa.has(c.publicId) && !votoValido(mapa.get(c.publicId), c.publicId))) {
            throw new Error('Resposta inválida ao consultar os votos.');
        }
        controles.forEach(controle => {
            const voto = mapa.get(controle.publicId);
            controle.estado = voto || 'indisponivel'; controle.csrfToken = dados.csrfToken;
            if (voto) controle.total = voto.votos;
            atualizarBotaoVoto(controle);
        });
    } catch (erro) {
        if (erro.name === 'AbortError') return;
        controles.forEach(controle => {
            controle.estado = 'erro'; atualizarBotaoVoto(controle);
            informarVoto(controle, 'Não foi possível consultar seus votos. Clique no contador para tentar novamente.');
        });
    }
}

async function acionarVoto(controle) {
    if (controle.botao.disabled || controle.enviando) return;
    if (controle.estado === 'visitante') {
        window.location.assign('/login?proximo=' + encodeURIComponent(window.location.pathname + window.location.search));
        return;
    }
    if (controle.estado === 'erro') {
        await carregarVotos([controle]);
        if (typeof controle.estado === 'object') informarVoto(controle, 'Votos atualizados. Confira o estado antes de votar ou retirar.');
        return;
    }
    const votar = !controle.estado.votado;
    controle.enviando = true; atualizarBotaoVoto(controle); informarVoto(controle, 'Salvando voto…');
    try {
        const resposta = await fetch('/api/relatos/' + encodeURIComponent(controle.publicId) + '/voto', {
            method: votar ? 'PUT' : 'DELETE', credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': controle.csrfToken },
            body: JSON.stringify({}),
        });
        const dados = await resposta.json();
        if (!resposta.ok) {
            controle.estado = resposta.status === 401 ? 'visitante' : resposta.status === 404 ? 'indisponivel' : 'erro';
            throw new Error(dados.erro || 'Não foi possível salvar seu voto.');
        }
        if (dados.ok !== true || !votoValido(dados.voto, controle.publicId) || dados.voto.votado !== votar) {
            throw new Error('Resposta inválida ao salvar o voto.');
        }
        controle.estado = dados.voto; controle.total = dados.voto.votos;
        informarVoto(controle, votar ? 'Voto registrado.' : 'Voto retirado.');
    } catch (erro) {
        if (typeof controle.estado === 'object') controle.estado = 'erro';
        informarVoto(controle, erro.message + (controle.estado === 'erro'
            ? ' Clique no contador para consultar o estado antes de tentar novamente.' : ''));
    } finally { controle.enviando = false; atualizarBotaoVoto(controle); }
}

function renderPagination(paginacao) {
    const nav = document.querySelector('.cards-section .pagination');
    nav.replaceChildren();
    const ultima = Math.min(paginacao.paginas, 10000);
    if (!ultima) return;
    function paginaLink(texto, pagina, rotulo, desabilitado = false) {
        const link = criarElemento('a', texto);
        link.href = '?pagina=' + pagina;
        link.setAttribute('aria-label', rotulo);
        if (desabilitado) { link.setAttribute('aria-disabled', 'true'); link.tabIndex = -1; }
        if (pagina === paginacao.pagina && !rotulo.includes('anterior') && !rotulo.includes('Próxima')) {
            link.classList.add('active'); link.setAttribute('aria-current', 'page');
        }
        link.addEventListener('click', event => { event.preventDefault(); if (!desabilitado) renderCards(pagina); });
        return link;
    }
    nav.append(paginaLink('←', Math.max(1, paginacao.pagina - 1), 'Página anterior', paginacao.pagina <= 1));
    const paginas = [...new Set([1, paginacao.pagina - 1, paginacao.pagina, paginacao.pagina + 1, ultima])]
        .filter(p => p >= 1 && p <= ultima).sort((a, b) => a - b);
    let anterior = 0;
    paginas.forEach(p => {
        if (anterior && p - anterior > 1) nav.append(criarElemento('span', '...'));
        nav.append(paginaLink(String(p), p, 'Página ' + p)); anterior = p;
    });
    nav.append(paginaLink('→', Math.min(ultima, paginacao.pagina + 1), 'Próxima página', paginacao.pagina >= ultima));
}

async function renderCards(pagina = 1) {
    const grid = document.querySelector('#reports-grid');
    const count = document.querySelector('#results-count');
    const chamada = ++versaoDaBusca;
    buscaEmAndamento?.abort();
    const consulta = new AbortController(); buscaEmAndamento = consulta;
    grid.setAttribute('aria-busy', 'true'); count.setAttribute('role', 'status');
    count.textContent = 'Carregando relatos…';
    grid.replaceChildren(); document.querySelector('.cards-section .pagination').replaceChildren();
    try {
        const resposta = await fetch('/api/relatos?' + parametrosDaLista(pagina), {
            credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: consulta.signal,
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível carregar os relatos.');
        if (!Array.isArray(dados.relatos) || !dados.paginacao || !Array.isArray(dados.filtros?.categorias) ||
            !Array.isArray(dados.filtros?.bairros) || !Array.isArray(dados.destaques) ||
            !Array.isArray(dados.porBairro) || !dados.resumo) throw new Error('Resposta inválida ao carregar os relatos.');
        if (!Number.isInteger(dados.paginacao.pagina) || dados.paginacao.pagina < 1 ||
            !Number.isInteger(dados.paginacao.total) || dados.paginacao.total < 0 ||
            !Number.isInteger(dados.paginacao.paginas) || dados.paginacao.paginas < 0) {
            throw new Error('Paginação inválida ao carregar os relatos.');
        }
        if (chamada !== versaoDaBusca) return;
        fillSelects(dados.filtros);
        atualizarResumo(dados.resumo);
        renderFeatured(dados.destaques);
        renderNeighborhoods(dados.porBairro);
        const controlesVotos = [];
        grid.replaceChildren(...dados.relatos.map(relato => criarCard(relato, controlesVotos)));
        if (!dados.relatos.length) grid.append(criarElemento('p', 'Nenhum relato publicado corresponde à busca.'));
        const total = dados.paginacao.total;
        count.textContent = total === 1 ? '1 relato encontrado' : total + ' relatos encontrados';
        renderPagination(dados.paginacao);
        // Consulta privada em lote, sem impedir a leitura pública dos cards.
        carregarVotos(controlesVotos, consulta.signal);
    } catch (erro) {
        if (chamada !== versaoDaBusca || erro.name === 'AbortError') return;
        count.textContent = 'Não foi possível carregar os relatos.';
        const tentar = criarElemento('button', 'Tentar novamente'); tentar.type = 'button';
        tentar.addEventListener('click', () => renderCards(pagina));
        grid.replaceChildren(criarElemento('p', erro.message), tentar);
    } finally { if (chamada === versaoDaBusca) grid.setAttribute('aria-busy', 'false'); }
}

function fillSelects(filtros) {
    for (const [id, itens, chave, texto, vazio] of [
        ['#category-filter', filtros.categorias, 'slug', 'Categoria', 'Todas'],
        ['#neighborhood-filter', filtros.bairros, 'id', 'Bairro', 'Todos'],
    ]) {
        const select = document.querySelector(id), atual = select.value;
        const primeira = criarElemento('option', texto); primeira.value = vazio;
        select.replaceChildren(primeira);
        itens.forEach(item => { const opcao = criarElemento('option', item.nome); opcao.value = item[chave]; select.append(opcao); });
        select.value = [...select.options].some(opcao => opcao.value === atual) ? atual : vazio;
    }
}

function atualizarResumo(resumo) {
    const metricas = {
        '#hero-total': resumo.total,
        '#hero-resolved': resumo.resolvidos,
        '#hero-neighborhoods': resumo.bairros,
        '#metric-total': resumo.total,
        '#metric-open': resumo.abertos,
        '#metric-progress': resumo.emAndamento,
        '#metric-resolved': resumo.resolvidos,
        '#metric-neighborhoods': resumo.bairros,
    };
    for (const [seletor, valor] of Object.entries(metricas)) {
        if (!Number.isSafeInteger(valor) || valor < 0) throw new Error('Resumo de relatos inválido.');
        document.querySelector(seletor).textContent = valor.toLocaleString('pt-BR');
    }
}

function renderFeatured(relatos) {
    const grid = document.querySelector('#featured-grid');
    const cards = relatos.slice(0, 2).map(relato => {
        const artigo = criarElemento('article', undefined, 'featured-card');
        artigo.style.setProperty('--accent', coresCategoria[relato.categoriaSlug] || '#147a43');
        const cabecalho = criarElemento('header');
        cabecalho.append(
            criarElemento('span', relato.categoria, 'category-badge'),
            criarElemento('span', '▲ ' + relato.votos, 'votes')
        );
        const tags = criarElemento('section', undefined, 'tag-list');
        const data = new Date(relato.criadoEm);
        const enviado = Number.isNaN(data.getTime()) ? 'Data indisponível' : data.toLocaleDateString('pt-BR');
        tags.append(
            criarElemento('span', relato.bairro),
            criarElemento('span', rotulosStatus[relato.status] || relato.status),
            criarElemento('span', enviado)
        );
        const link = criarElemento('a', 'Ver relato completo →');
        link.href = '/relatos/' + encodeURIComponent(relato.publicId);
        artigo.append(cabecalho, criarElemento('h3', relato.titulo), criarElemento('p', relato.descricao), tags, link);
        return artigo;
    });
    if (!cards.length) cards.push(criarElemento('p', 'Ainda não há relatos em destaque.'));
    grid.replaceChildren(...cards);
}

function renderNeighborhoods(bairros) {
    const lista = document.querySelector('#neighborhood-ranking');
    const maximo = Math.max(0, ...bairros.map(bairro => bairro.total));
    const itens = bairros.slice(0, 8).map((bairro, indice) => {
        if (!Number.isSafeInteger(bairro.total) || bairro.total < 0) throw new Error('Resumo de bairros inválido.');
        const item = criarElemento('li');
        const barra = criarElemento('span', undefined, 'rank-bar');
        const progresso = criarElemento('span');
        progresso.style.setProperty('width', maximo ? `${(bairro.total / maximo) * 100}%` : '0%');
        barra.append(progresso);
        item.append(
            criarElemento('span', String(indice + 1).padStart(2, '0'), 'rank-number'),
            criarElemento('strong', bairro.nome),
            barra,
            criarElemento('span', `${bairro.total.toLocaleString('pt-BR')} relatos`, 'rank-count')
        );
        return item;
    });
    if (!itens.length) itens.push(criarElemento('li', 'Ainda não há relatos por bairro.'));
    lista.replaceChildren(...itens);
}

function bindEvents() {
    document.querySelectorAll('.tab').forEach((button) => {
        button.addEventListener('click', () => {
            activeStatus = button.dataset.status;
            document.querySelectorAll('.tab').forEach((tab) => {
                const active = tab === button;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-pressed', String(active));
            });
            renderCards();
        });
    });

    ['#category-filter', '#neighborhood-filter', '#period-filter', '#sort-filter'].forEach((selector) => {
        document.querySelector(selector).addEventListener('change', () => renderCards());
    });
    let timer;
    const busca = document.querySelector('#report-search'); busca.maxLength = 100;
    busca.addEventListener('input', () => {
        ++versaoDaBusca; buscaEmAndamento?.abort(); clearTimeout(timer);
        timer = setTimeout(() => renderCards(), 300);
    });
    document.querySelector('.filter-form').addEventListener('submit', event => event.preventDefault());
}

bindEvents();
renderCards();
