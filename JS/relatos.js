const reports = [
    { id: 1, category: 'Alagamento', neighborhood: 'Vila Madalena', title: 'Rua das Flores completamente alagada', description: "Nivel d'agua subiu 40cm apos 30min de chuva. Drenos obstruídos ha semanas.", status: 'Aberto', time: 'Ha 2 horas', votes: 34, tone: '#2469d6', period: '24 horas' },
    { id: 2, category: 'Queimada', neighborhood: 'Bras', title: 'Foco de queimada próximo a linha ferrea', description: 'Fumaça intensa visivel a 2km. Bombeiros acionados mas sem resposta ainda.', status: 'Em andamento', time: 'Ha 4 horas', votes: 67, tone: '#d62727', period: '24 horas' },
    { id: 3, category: 'Calor Extremo', neighborhood: 'Consolação', title: 'Ponto de hidratação desativado na praça', description: 'Com 38 graus, o ponto de apoio montado pela prefeitura foi retirado sem aviso previo.', status: 'Aberto', time: 'Ha 6 horas', votes: 29, tone: '#f35c22', period: '24 horas' },
    { id: 4, category: 'Lixo Irregular', neighborhood: 'Mooca', title: 'Descarte irregular de entulho na Av. Paes', description: 'Toneladas de residuos de construcao bloqueando parcialmente a calcada.', status: 'Aberto', time: 'Ha 1 dia', votes: 18, tone: '#8b6328', period: '7 dias' },
    { id: 5, category: 'Alagamento', neighborhood: 'Butanta', title: 'Córrego transbordando para rua residencial', description: 'Moradores isolados. Água invadiu garagens. Situação critica.', status: 'Em andamento', time: 'Ha 1 dia', votes: 51, tone: '#2469d6', period: '7 dias' },
    { id: 6, category: 'Arvore Caida', neighborhood: 'Oscar', title: 'Arvore de grande porte caida na Rua Oscar', description: 'Bloqueia 70% da via. Risco de dano ao poste de energia.', status: 'Resolvido', time: 'Ha 2 dias', votes: 12, tone: '#63a93a', period: '7 dias' },
    { id: 7, category: 'Poluição Agua', neighborhood: 'Tatuape', title: 'Esgoto a céu aberto na Rua Tavares', description: 'Vazamento de esgoto há mais de 2 dias. Cheiro forte e risco sanitário.', status: 'Aberto', time: 'Ha 3 dias', votes: 23, tone: '#16a3a3', period: '7 dias' },
    { id: 8, category: 'Calor Extremo', neighborhood: 'Perdizes', title: 'Escola sem ar-condicionado com 37 graus', description: 'Crianças passaram mal. Professores relatam temperatura insuportável em salas.', status: 'Aberto', time: 'Ha 4 dias', votes: 40, tone: '#f35c22', period: '30 dias' },
    { id: 9, category: 'Queimada', neighborhood: 'Lapa', title: 'Área verde no Córrego Sapateiro queimando', description: 'Vegetação em chamas ao lado de residências. Vento espalhando faíscas.', status: 'Resolvido', time: 'Há 5 dias', votes: 76, tone: '#d62727', period: '30 dias' },
];

const categoryDistribution = [
    ['Alagamento', 40, '#2469d6'],
    ['Calor Extremo', 24, '#f35c22'],
    ['Queimada', 18, '#d62727'],
    ['Lixo Irregular', 11, '#8b6328'],
    ['Arvore Caida', 7, '#63a93a'],
    ['Poluicao Agua', 2, '#16a3a3'],
];

const neighborhoodRanking = [
    ['Bras', 147, 'CRITICA', '#d62727'],
    ['Vila Madalena', 118, 'CRITICA', '#d62727'],
    ['Pinheiros', 94, 'ALTA', '#f37d22'],
    ['Mooca', 82, 'ALTA', '#f37d22'],
    ['Consolacao', 61, 'MEDIA', '#f4b60d'],
    ['Butanta', 55, 'MEDIA', '#f4b60d'],
    ['Perdizes', 28, 'BAIXA', '#1a9651'],
    ['Lapa', 19, 'BAIXA', '#1a9651'],
];

let activeStatus = 'Todos';

function statusClass(status) {
    if (status === 'Em andamento') return 'status-progress';
    if (status === 'Resolvido') return 'status-done';
    return 'status-open';
}

function getFilteredReports() {
    const category = document.querySelector('#category-filter').value;
    const neighborhood = document.querySelector('#neighborhood-filter').value;
    const period = document.querySelector('#period-filter').value;
    const search = document.querySelector('#report-search').value.trim().toLowerCase();
    const sort = document.querySelector('#sort-filter').value;

    const filtered = reports.filter((report) => {
        const statusMatch = activeStatus === 'Todos' || report.status === activeStatus;
        const categoryMatch = category === 'Todas' || category === 'Categoria' || report.category === category;
        const neighborhoodMatch = neighborhood === 'Todos' || neighborhood === 'Bairro' || report.neighborhood === neighborhood;
        const periodMatch = period === 'Periodo' || report.period === period;
        const searchMatch = !search || `${report.title} ${report.description} ${report.neighborhood}`.toLowerCase().includes(search);
        return statusMatch && categoryMatch && neighborhoodMatch && periodMatch && searchMatch;
    });

    if (sort === 'votes') return filtered.sort((a, b) => b.votes - a.votes);
    if (sort === 'oldest') return filtered.sort((a, b) => a.id - b.id);
    return filtered.sort((a, b) => b.id - a.id);
}

function renderCards() {
    const grid = document.querySelector('#reports-grid');
    const data = getFilteredReports();
    document.querySelector('#results-count').textContent = `${data.length || 0} relatos encontrados`;

    grid.innerHTML = data.map((report) => `
        <article class="report-card" style="--accent:${report.tone}">
            <div class="report-card-inner">
                <header class="card-meta">
                    <span class="category-badge">${report.category}</span>
                    <span class="neighborhood">${report.neighborhood}</span>
                </header>
                <h3>${report.title}</h3>
                <p>${report.description}</p>
                <footer class="card-footer">
                    <span class="status-badge ${statusClass(report.status)}">${report.status}</span>
                    <time class="time">${report.time}</time>
                    <span class="votes">▲ ${report.votes}</span>
                    <a class="arrow" href="#" aria-label="Abrir relato ${report.title}">→</a>
                </footer>
            </div>
        </article>
    `).join('');
}

function fillSelects() {
    const categories = [...new Set(reports.map((report) => report.category))];
    const neighborhoods = [...new Set(reports.map((report) => report.neighborhood))];
    document.querySelector('#category-filter').innerHTML += categories.map((item) => `<option>${item}</option>`).join('');
    document.querySelector('#neighborhood-filter').innerHTML += neighborhoods.map((item) => `<option>${item}</option>`).join('');
}

function renderFeatured() {
    const featured = [...reports].sort((a, b) => b.votes - a.votes).slice(0, 2);
    document.querySelector('#featured-grid').innerHTML = featured.map((report) => `
        <article class="featured-card" style="--accent:${report.tone}">
            <header>
                <span class="category-badge">${report.category}</span>
                <span class="votes">▲ ${report.votes}</span>
            </header>
            <h3>${report.title}</h3>
            <p>${report.description}</p>
            <div class="tag-list">
                <span>${report.neighborhood}</span>
                <span>${report.status}</span>
                <span>${report.time}</span>
            </div>
            <a href="#">Ver relato completo -></a>
        </article>
    `).join('');
}

function renderCategoryBars() {
    document.querySelector('#category-bars').innerHTML = categoryDistribution.map(([name, percent, color]) => `
        <div class="category-row" style="--accent:${color}">
            <span>${name}</span>
            <span class="bar"><span style="width:${percent}%"></span></span>
            <strong>${percent}%</strong>
        </div>
    `).join('');
}

function renderNeighborhoods() {
    const max = Math.max(...neighborhoodRanking.map((item) => item[1]));
    document.querySelector('#neighborhood-ranking').innerHTML = neighborhoodRanking.map(([name, count, risk, color], index) => `
        <li style="--accent:${color}">
            <span class="rank-number">${String(index + 1).padStart(2, '0')}</span>
            <strong>${name}</strong>
            <span class="rank-bar"><span style="width:${(count / max) * 100}%"></span></span>
            <span class="rank-count">${count} relatos</span>
            <span class="risk-badge">${risk}</span>
        </li>
    `).join('');
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
        document.querySelector(selector).addEventListener('change', renderCards);
    });
    document.querySelector('#report-search').addEventListener('input', renderCards);
}

fillSelects();
bindEvents();
renderCards();
renderFeatured();
renderCategoryBars();
renderNeighborhoods();
