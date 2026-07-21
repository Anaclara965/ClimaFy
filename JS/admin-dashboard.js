const kpis = [
    { value: '1.247', label: 'Relatos Ativos', helper: '↑ 8% esta semana', icon: '▣', color: '#d62727', soft: '#ffe0e0' },
    { value: '47', label: 'Pendentes Mod.', helper: 'Aguardando revisão', icon: '⌛', color: '#f4b60d', soft: '#fff6d6' },
    { value: '312', label: 'Aprovados (mês)', helper: '↑ 23% vs anterior', icon: '✓', color: '#1a9651', soft: '#e0f5e9' },
    { value: '29', label: 'Rejeitados (mês)', helper: '2,3% dos enviados', icon: '×', color: '#48525f', soft: '#eff3f5' },
    { value: '8', label: 'Cidades Ativas', helper: 'São Paulo + 7', icon: '▥', color: '#2469d6', soft: '#e0efff' },
];

const moderationRows = [
    { title: 'Córrego Tatuapé transbordou', category: 'Alagamento', neighborhood: 'Brás', time: 'Há 12 min', color: '#2469d6' },
    { title: 'Queimada próx. linha férrea', category: 'Queimada', neighborhood: 'Vila Mad.', time: 'Há 34 min', color: '#d62727' },
    { title: 'Lixo irregular Av. Rangel', category: 'Lixo Irreg.', neighborhood: 'Consolação', time: 'Há 1h', color: '#f4b60d' },
    { title: 'Ponto de hidratação fechado', category: 'Calor Ext.', neighborhood: 'Pinheiros', time: 'Há 2h', color: '#f37d22' },
    { title: 'Árvore caída Rua das Flores', category: 'Árvore', neighborhood: 'Perdizes', time: 'Há 3h', color: '#63a93a' },
];

const activities = [
    { text: 'Relato aprovado: Alagamento Brás', time: 'Há 2 min', color: '#1a9651' },
    { text: 'Novo usuário cadastrado', time: 'Há 14 min', color: '#2469d6' },
    { text: 'Relato rejeitado: conteúdo inválido', time: 'Há 32 min', color: '#d62727' },
    { text: 'Relato aprovado: Queimada Vila Mad.', time: 'Há 1h', color: '#1a9651' },
    { text: 'CSV importado: 48 investimentos', time: 'Há 2h', color: '#f4b60d' },
    { text: 'Novo usuário: maria.o@gmail.com', time: 'Há 3h', color: '#2469d6' },
];

const dailyReports = [
    ['S', 75], ['T', 112], ['Q', 93], ['Q', 163], ['S', 197], ['S', 139], ['D', 101],
    ['S', 120], ['T', 155], ['Q', 189], ['Q', 235], ['S', 171], ['S', 131], ['D', 112],
];

const categoryStats = [
    { label: 'Alagamento', value: 487, percent: 39, color: '#2469d6' },
    { label: 'Calor Extremo', value: 298, percent: 24, color: '#f37d22' },
    { label: 'Queimada', value: 186, percent: 15, color: '#d62727' },
    { label: 'Lixo Irregular', value: 149, percent: 12, color: '#f4b60d' },
    { label: 'Árvore Caída', value: 87, percent: 7, color: '#63a93a' },
    { label: 'Outros', value: 40, percent: 3, color: '#d1d8de' },
];

function softTone(color) {
    return `${color}1f`;
}

function renderKpis() {
    const target = document.querySelector('#kpi-grid');

    target.innerHTML = kpis.map((kpi) => `
        <article class="kpi-card" style="--tone:${kpi.color};--tone-soft:${kpi.soft}">
            <dl>
                <div class="kpi-top">
                    <dt class="kpi-icon" aria-hidden="true">${kpi.icon}</dt>
                    <dd>${kpi.value}</dd>
                </div>
                <dt>${kpi.label}</dt>
                <small>${kpi.helper}</small>
            </dl>
        </article>
    `).join('');
}

function renderModerationRows() {
    const target = document.querySelector('#moderation-body');

    target.innerHTML = moderationRows.map((row, index) => `
        <tr data-row="${index}">
            <td>${row.title}</td>
            <td>
                <span class="category-chip" style="--chip-color:${row.color};--chip-bg:${softTone(row.color)}">${row.category}</span>
            </td>
            <td>${row.neighborhood}</td>
            <td>${row.time}</td>
            <td>
                <div class="row-actions">
                    <button class="approve" type="button" data-action="approve">✓ Aprovar</button>
                    <button class="reject" type="button" data-action="reject">× Negar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderActivities() {
    const target = document.querySelector('#activity-list');

    target.innerHTML = activities.map((item) => `
        <li>
            <span class="activity-dot" style="--dot:${item.color}" aria-hidden="true"></span>
            <article>
                <p>${item.text}</p>
                <time>${item.time}</time>
            </article>
        </li>
    `).join('');
}

function renderDailyChart() {
    const target = document.querySelector('#daily-chart');
    const max = Math.max(...dailyReports.map(([, value]) => value));

    target.innerHTML = dailyReports.map(([day, value], index) => {
        const height = Math.round((value / max) * 235);
        const color = index === dailyReports.length - 1 ? '#1a9651' : '#dfe5e9';

        return `
            <li>
                <span style="height:${height}px;--bar:${color}" title="${value} relatos"></span>
                <span>${day}</span>
            </li>
        `;
    }).join('');
}

function renderCategoryBars() {
    const target = document.querySelector('#category-bars');

    target.innerHTML = categoryStats.map((item) => `
        <div class="category-row" style="--color:${item.color}">
            <dt>${item.label}</dt>
            <div class="category-track">
                <span class="category-fill" style="width:${item.percent}%">${item.value}</span>
            </div>
            <dd>${item.percent}%</dd>
        </div>
    `).join('');
}

function bindModerationActions() {
    document.querySelector('#moderation-body').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const row = button.closest('tr');
        const isApprove = button.dataset.action === 'approve';
        row.style.opacity = '0.54';
        row.querySelector('.row-actions').innerHTML = `<span class="${isApprove ? 'approve' : 'reject'} category-chip">${isApprove ? 'Aprovado' : 'Negado'}</span>`;
    });
}

renderKpis();
renderModerationRows();
renderActivities();
renderDailyChart();
renderCategoryBars();
bindModerationActions();
