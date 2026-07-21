const tabs = [
    ['Todos', 156, 'all'],
    ['Pendentes', 47, 'pending'],
    ['Aprovados', 89, 'approved'],
    ['Rejeitados', 20, 'rejected'],
];

const stats = [
    ['47', 'Aguardando revisão', '#f4b60d'],
    ['4h', 'Tempo médio p/ revisão', '#48525f'],
    ['98%', 'Taxa de aprovação', '#1a9651'],
    ['12', 'Revisados hoje', '#2469d6'],
];

const reports = [
    {
        title: 'Córrego Tatuapé transbordou e isolou famílias',
        description: "Nível d'água subiu 60cm. Famílias ilhadas.",
        category: 'Alagamento',
        neighborhood: 'Brás',
        user: 'joao.silva',
        time: 'Há 12 min',
        photo: true,
        color: '#2469d6',
        status: 'pending',
    },
    {
        title: 'Foco de queimada próximo à linha férrea central',
        description: 'Fumaça densa a 2km. Bombeiros sem resposta.',
        category: 'Queimada',
        neighborhood: 'Vila Madalena',
        user: 'maria.o',
        time: 'Há 34 min',
        photo: true,
        color: '#d62727',
        status: 'pending',
    },
    {
        title: 'Ponto de hidratação desativado na praça central',
        description: '38°C sem ponto de apoio. Risco para idosos.',
        category: 'Calor Extremo',
        neighborhood: 'Pinheiros',
        user: 'carlos.a',
        time: 'Há 1h',
        photo: false,
        color: '#f37d22',
        status: 'pending',
    },
    {
        title: 'Lixo irregular bloqueando calçada da Av. Rangel',
        description: 'Entulho de obra acumulado há 3 dias.',
        category: 'Lixo Irregular',
        neighborhood: 'Consolação',
        user: 'ana.r',
        time: 'Há 2h',
        photo: true,
        color: '#f4b60d',
        status: 'pending',
    },
    {
        title: 'Árvore de grande porte caída bloqueando via',
        description: '70% da rua bloqueada. Risco ao poste.',
        category: 'Árvore Caída',
        neighborhood: 'Perdizes',
        user: 'pedro.l',
        time: 'Há 3h',
        photo: true,
        color: '#63a93a',
        status: 'pending',
    },
    {
        title: 'Esgoto a céu aberto na Rua das Figueiras',
        description: 'Vazamento há mais de 5 dias. Risco sanitário.',
        category: 'Poluição Água',
        neighborhood: 'Lapa',
        user: 'lucia.m',
        time: 'Há 4h',
        photo: false,
        color: '#129ab9',
        status: 'pending',
    },
];

let activeTab = 'pending';
let query = '';
let sortMode = 'oldest';
let pendingRejectIndex = null;
let pendingRejectRow = null;

function renderTabs() {
    const target = document.querySelector('#status-tabs');
    target.innerHTML = tabs.map(([label, count, value]) => `
        <li>
            <button class="${activeTab === value ? 'active' : ''}" type="button" data-tab="${value}">
                ${label}
                <span>${count}</span>
            </button>
        </li>
    `).join('');
}

function renderStats() {
    document.querySelector('#moderation-stats').innerHTML = stats.map(([value, label, color]) => `
        <div style="--color:${color}">
            <dd>${value}</dd>
            <dt>${label}</dt>
        </div>
    `).join('');
}

function getVisibleReports() {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = reports.filter((report) => {
        const statusMatch = activeTab === 'all' || report.status === activeTab;
        const textMatch = !normalizedQuery || `${report.title} ${report.description} ${report.neighborhood} ${report.user}`.toLowerCase().includes(normalizedQuery);
        return statusMatch && textMatch;
    });

    if (sortMode === 'newest') return [...filtered].reverse();
    return filtered;
}

function renderReports() {
    const target = document.querySelector('#review-body');
    const visibleReports = getVisibleReports();

    target.innerHTML = visibleReports.map((report, index) => `
        <tr data-index="${reports.indexOf(report)}">
            <td>
                <article>
                    <h3 class="report-title">${report.title}</h3>
                    <p class="report-desc">${report.description}</p>
                </article>
            </td>
            <td><span class="category-chip" style="--chip-color:${report.color};--chip-bg:${report.color}1f">${report.category}</span></td>
            <td>${report.neighborhood}</td>
            <td><span class="user-name">${report.user}</span><span class="user-state">Usuário ativo</span></td>
            <td>${report.time}</td>
            <td><span class="photo-chip" style="--photo-bg:${report.photo ? '#e0f5e9' : '#eff3f5'};--photo-color:${report.photo ? '#1a9651' : '#8b96a3'}">${report.photo ? 'Sim' : 'Não'}</span></td>
            <td><a class="location-link" href="#">📍 Ver no mapa</a></td>
            <td>
                <div class="review-actions">
                    <button class="approve" type="button" data-action="approve">✓ Aprovar</button>
                    <button class="reject" type="button" data-action="reject">× Negar</button>
                    <button class="details" type="button">Detalhes</button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelector('#pagination-summary').textContent = `Mostrando ${visibleReports.length ? '1' : '0'}–${visibleReports.length} de 47 relatos pendentes`;
}

function bindEvents() {
    const rejectModal = document.querySelector('#reject-modal');
    const rejectForm = document.querySelector('#reject-form');
    const rejectReason = document.querySelector('#reject-reason');
    const rejectNote = document.querySelector('#reject-note');

    document.querySelector('#status-tabs').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-tab]');
        if (!button) return;

        activeTab = button.dataset.tab;
        renderTabs();
        renderReports();
    });

    document.querySelector('#moderation-search').addEventListener('input', (event) => {
        query = event.target.value;
        renderReports();
    });

    document.querySelector('#moderation-sort').addEventListener('change', (event) => {
        sortMode = event.target.value;
        renderReports();
    });

    document.querySelector('#review-body').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const row = button.closest('tr');
        const report = reports[Number(row.dataset.index)];
        if (button.dataset.action === 'reject') {
            pendingRejectIndex = Number(row.dataset.index);
            pendingRejectRow = row;
            rejectReason.value = '';
            rejectNote.value = '';
            rejectModal.showModal();
            rejectReason.focus();
            return;
        }

        report.status = 'approved';
        row.style.opacity = '0.58';
        row.querySelector('.review-actions').innerHTML = '<span class="category-chip" style="--chip-color:#1a9651;--chip-bg:#e0f5e9">Aprovado</span>';
    });

    document.querySelector('#reject-cancel').addEventListener('click', () => {
        pendingRejectIndex = null;
        pendingRejectRow = null;
        rejectModal.close();
    });

    rejectForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!rejectReason.value || pendingRejectIndex === null) return;

        reports[pendingRejectIndex].status = 'rejected';
        reports[pendingRejectIndex].rejectionReason = rejectReason.value;
        reports[pendingRejectIndex].rejectionNote = rejectNote.value;
        rejectModal.close();
        if (pendingRejectRow) {
            pendingRejectRow.style.opacity = '0.58';
            pendingRejectRow.querySelector('.review-actions').innerHTML = '<span class="category-chip" style="--chip-color:#d62727;--chip-bg:#ffe0e0">Negado</span>';
        }
        pendingRejectIndex = null;
        pendingRejectRow = null;
    });
}

renderTabs();
renderStats();
renderReports();
bindEvents();
