const adminAreaData = {
    relatos: {
        rows: [
            { id: '#1247', title: 'Alagamento na Rua do Gasômetro', subtitle: 'Enviado por Ana Martins', category: 'Alagamento', place: 'Brás', date: '26/07/2026', status: 'Publicado' },
            { id: '#1246', title: 'Foco de queimada próximo à estação', subtitle: 'Enviado por Carlos Lima', category: 'Queimada', place: 'Vila Madalena', date: '26/07/2026', status: 'Pendente' },
            { id: '#1245', title: 'Descarte irregular em calçada', subtitle: 'Enviado por Marina Souza', category: 'Lixo irregular', place: 'Consolação', date: '25/07/2026', status: 'Publicado' },
            { id: '#1244', title: 'Árvore caída bloqueando a via', subtitle: 'Enviado por João Santos', category: 'Árvore caída', place: 'Perdizes', date: '25/07/2026', status: 'Rejeitado' },
            { id: '#1243', title: 'Ponto de hidratação indisponível', subtitle: 'Enviado por Beatriz Alves', category: 'Calor extremo', place: 'Pinheiros', date: '24/07/2026', status: 'Publicado' },
            { id: '#1242', title: 'Bueiro obstruído após chuva', subtitle: 'Enviado por Lucas Rocha', category: 'Alagamento', place: 'Mooca', date: '24/07/2026', status: 'Pendente' },
        ],
    },
    usuarios: {
        rows: [
            { id: '#U247', title: 'Ana Martins', subtitle: 'ana.martins@email.com', profile: 'Cidadã', joined: '18/02/2026', reports: 18, status: 'Ativo' },
            { id: '#U246', title: 'Carlos Lima', subtitle: 'carlos.lima@email.com', profile: 'Cidadão', joined: '03/03/2026', reports: 12, status: 'Ativo' },
            { id: '#U245', title: 'Marina Souza', subtitle: 'marina.souza@email.com', profile: 'Voluntária', joined: '21/03/2026', reports: 31, status: 'Ativo' },
            { id: '#U244', title: 'João Santos', subtitle: 'joao.santos@email.com', profile: 'Cidadão', joined: '12/04/2026', reports: 5, status: 'Bloqueado' },
            { id: '#U243', title: 'Beatriz Alves', subtitle: 'beatriz.alves@email.com', profile: 'Voluntária', joined: '07/05/2026', reports: 24, status: 'Ativo' },
            { id: '#U242', title: 'Lucas Rocha', subtitle: 'lucas.rocha@email.com', profile: 'Cidadão', joined: '19/06/2026', reports: 7, status: 'Pendente' },
        ],
    },
    investimentos: {
        rows: [
            { id: '#INV-092', title: 'Ampliação da drenagem urbana', subtitle: 'Programa de prevenção a enchentes', place: 'Sé', amount: 'R$ 4,8 mi', progress: 72, status: 'Em execução' },
            { id: '#INV-091', title: 'Novos pontos de hidratação', subtitle: 'Plano municipal para ondas de calor', place: 'Pinheiros', amount: 'R$ 1,2 mi', progress: 45, status: 'Em execução' },
            { id: '#INV-090', title: 'Requalificação de áreas verdes', subtitle: 'Plantio e manejo de arborização', place: 'Lapa', amount: 'R$ 2,6 mi', progress: 88, status: 'Em execução' },
            { id: '#INV-089', title: 'Monitoramento de córregos', subtitle: 'Sensores e alertas antecipados', place: 'Mooca', amount: 'R$ 3,1 mi', progress: 100, status: 'Concluído' },
            { id: '#INV-088', title: 'Ecopontos comunitários', subtitle: 'Combate ao descarte irregular', place: 'Itaquera', amount: 'R$ 980 mil', progress: 20, status: 'Planejado' },
            { id: '#INV-087', title: 'Revitalização de bueiros', subtitle: 'Limpeza e substituição de grades', place: 'Brás', amount: 'R$ 1,7 mi', progress: 61, status: 'Em execução' },
        ],
    },
};

const statusTones = {
    Publicado: ['#e0f5e9', '#147a43'],
    Pendente: ['#fff6d6', '#8a6500'],
    Rejeitado: ['#ffe0e0', '#d62727'],
    Ativo: ['#e0f5e9', '#147a43'],
    Bloqueado: ['#ffe0e0', '#d62727'],
    'Em execução': ['#e0efff', '#2469d6'],
    Concluído: ['#e0f5e9', '#147a43'],
    Planejado: ['#fff6d6', '#8a6500'],
};

const page = document.body.dataset.adminPage;
let rows = adminAreaData[page]?.rows || [];
let query = '';
let statusFilter = 'Todos';

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function statusPill(status) {
    const [background, color] = statusTones[status] || ['#eff3f5', '#48525f'];
    return `<span class="status-pill" style="--pill-bg:${background};--pill-color:${color}">${escapeHtml(status)}</span>`;
}

function visibleRows() {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return rows.filter((row) => {
        const matchesQuery = !normalizedQuery || Object.values(row)
            .some((value) => String(value).toLocaleLowerCase('pt-BR').includes(normalizedQuery));
        const matchesStatus = statusFilter === 'Todos' || row.status === statusFilter;
        return matchesQuery && matchesStatus;
    });
}

function reportRow(row) {
    return `
        <tr>
            <td>${escapeHtml(row.id)}</td>
            <td><strong class="cell-title">${escapeHtml(row.title)}</strong><span class="cell-subtitle">${escapeHtml(row.subtitle)}</span></td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.place)}</td>
            <td>${escapeHtml(row.date)}</td>
            <td>${statusPill(row.status)}</td>
            <td><section class="table-actions"><button class="view-action" data-message="Detalhes de ${escapeHtml(row.id)} abertos.">Detalhes</button><button class="danger-action" data-remove="${escapeHtml(row.id)}">Arquivar</button></section></td>
        </tr>`;
}

function userRow(row) {
    const actionLabel = row.status === 'Bloqueado' ? 'Desbloquear' : 'Bloquear';
    return `
        <tr>
            <td>${escapeHtml(row.id)}</td>
            <td><strong class="cell-title">${escapeHtml(row.title)}</strong><span class="cell-subtitle">${escapeHtml(row.subtitle)}</span></td>
            <td>${escapeHtml(row.profile)}</td>
            <td>${escapeHtml(row.joined)}</td>
            <td>${escapeHtml(row.reports)}</td>
            <td>${statusPill(row.status)}</td>
            <td><section class="table-actions"><button class="view-action" data-message="Perfil de ${escapeHtml(row.title)} aberto.">Ver perfil</button><button class="toggle-action" data-toggle="${escapeHtml(row.id)}">${actionLabel}</button></section></td>
        </tr>`;
}

function investmentRow(row) {
    const progressColor = row.progress === 100 ? '#147a43' : row.progress >= 60 ? '#2469d6' : '#f4b60d';
    return `
        <tr>
            <td>${escapeHtml(row.id)}</td>
            <td><strong class="cell-title">${escapeHtml(row.title)}</strong><span class="cell-subtitle">${escapeHtml(row.subtitle)}</span></td>
            <td>${escapeHtml(row.place)}</td>
            <td><strong class="cell-title">${escapeHtml(row.amount)}</strong></td>
            <td><span class="cell-subtitle">${row.progress}% executado</span><span class="progress-track"><span class="progress-fill" style="width:${row.progress}%;--progress-color:${progressColor}"></span></span></td>
            <td>${statusPill(row.status)}</td>
            <td><section class="table-actions"><button class="view-action" data-message="Investimento ${escapeHtml(row.id)} aberto.">Detalhes</button><button class="toggle-action" data-message="Edição de ${escapeHtml(row.id)} iniciada.">Editar</button></section></td>
        </tr>`;
}

function renderTable() {
    const body = document.querySelector('#area-table-body');
    if (!body) return;

    const filtered = visibleRows();
    const renderers = { relatos: reportRow, usuarios: userRow, investimentos: investmentRow };
    body.innerHTML = filtered.map(renderers[page]).join('');

    const emptyState = document.querySelector('#empty-state');
    emptyState.classList.toggle('visible', filtered.length === 0);
    document.querySelector('#area-count').textContent = `${filtered.length} de ${rows.length} registros`;
}

function showMessage(message) {
    document.querySelector('.activity-message')?.remove();
    const toast = document.createElement('p');
    toast.className = 'activity-message';
    toast.textContent = message;
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 2800);
}

function bindTableEvents() {
    document.querySelector('#area-search')?.addEventListener('input', (event) => {
        query = event.target.value;
        renderTable();
    });

    document.querySelector('#area-status')?.addEventListener('change', (event) => {
        statusFilter = event.target.value;
        renderTable();
    });

    document.querySelector('#area-table-body')?.addEventListener('click', (event) => {
        const messageButton = event.target.closest('[data-message]');
        if (messageButton) showMessage(messageButton.dataset.message);

        const removeButton = event.target.closest('[data-remove]');
        if (removeButton) {
            rows = rows.filter((row) => row.id !== removeButton.dataset.remove);
            renderTable();
            showMessage('Relato arquivado nesta visualização.');
        }

        const toggleButton = event.target.closest('[data-toggle]');
        if (toggleButton) {
            const user = rows.find((row) => row.id === toggleButton.dataset.toggle);
            if (!user) return;
            user.status = user.status === 'Bloqueado' ? 'Ativo' : 'Bloqueado';
            renderTable();
            showMessage(`Usuário ${user.status === 'Ativo' ? 'desbloqueado' : 'bloqueado'} nesta visualização.`);
        }
    });

    document.querySelectorAll('[data-message]').forEach((button) => {
        if (button.closest('#area-table-body')) return;
        button.addEventListener('click', () => showMessage(button.dataset.message));
    });
}

if (page !== 'relatorios') {
    renderTable();
}
bindTableEvents();
