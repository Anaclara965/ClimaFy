const neighborhoods = [
    {
        name: 'Brás',
        city: 'São Paulo, SP',
        reports: 147,
        investment: 124000,
        score: 91,
        classification: 'Crítica',
        tone: 'critical',
        trend: 12,
        categories: [
            { label: 'Alag.', value: 58, color: '#2469d6' },
            { label: 'Lixo', value: 18, color: '#8b6328' },
            { label: 'Fogo', value: 14, color: '#d62727' },
            { label: 'Arv.', value: 10, color: '#63a93a' },
        ],
    },
    {
        name: 'Vila Madalena',
        city: 'São Paulo, SP',
        reports: 118,
        investment: 210000,
        score: 88,
        classification: 'Crítica',
        tone: 'critical',
        trend: 8,
        categories: [
            { label: 'Fogo', value: 52, color: '#d62727' },
            { label: 'Alag.', value: 28, color: '#2469d6' },
            { label: 'Lixo', value: 12, color: '#8b6328' },
            { label: 'Arv.', value: 8, color: '#63a93a' },
        ],
    },
    {
        name: 'Pinheiros',
        city: 'São Paulo, SP',
        reports: 94,
        investment: 380000,
        score: 71,
        classification: 'Alta',
        tone: 'high',
        trend: 0,
        categories: [
            { label: 'Calor', value: 44, color: '#f35c22' },
            { label: 'Alag.', value: 32, color: '#2469d6' },
            { label: 'Lixo', value: 14, color: '#8b6328' },
            { label: 'Fogo', value: 10, color: '#d62727' },
        ],
    },
    {
        name: 'Mooca',
        city: 'São Paulo, SP',
        reports: 82,
        investment: 290000,
        score: 67,
        classification: 'Alta',
        tone: 'high',
        trend: 3,
        categories: [
            { label: 'Lixo', value: 58, color: '#8b6328' },
            { label: 'Alag.', value: 22, color: '#2469d6' },
            { label: 'Calor', value: 12, color: '#f35c22' },
            { label: 'Arv.', value: 8, color: '#63a93a' },
        ],
    },
    {
        name: 'Consolação',
        city: 'São Paulo, SP',
        reports: 67,
        investment: 455000,
        score: 49,
        classification: 'Média',
        tone: 'medium',
        trend: -3,
        categories: [
            { label: 'Calor', value: 46, color: '#f35c22' },
            { label: 'Alag.', value: 24, color: '#2469d6' },
            { label: 'Lixo', value: 20, color: '#8b6328' },
            { label: 'Arv.', value: 10, color: '#63a93a' },
        ],
    },
    {
        name: 'Butantã',
        city: 'São Paulo, SP',
        reports: 56,
        investment: 125000,
        score: 44,
        classification: 'Média',
        tone: 'medium',
        trend: 7,
        categories: [
            { label: 'Alag.', value: 38, color: '#2469d6' },
            { label: 'Arv.', value: 26, color: '#63a93a' },
            { label: 'Lixo', value: 22, color: '#8b6328' },
            { label: 'Calor', value: 14, color: '#f35c22' },
        ],
    },
    {
        name: 'Perdizes',
        city: 'São Paulo, SP',
        reports: 38,
        investment: 650000,
        score: 21,
        classification: 'Baixa',
        tone: 'low',
        trend: -4,
        categories: [
            { label: 'Arv.', value: 36, color: '#63a93a' },
            { label: 'Lixo', value: 28, color: '#8b6328' },
            { label: 'Alag.', value: 22, color: '#2469d6' },
            { label: 'Calor', value: 14, color: '#f35c22' },
        ],
    },
    {
        name: 'Lapa',
        city: 'São Paulo, SP',
        reports: 34,
        investment: 754000,
        score: 18,
        classification: 'Baixa',
        tone: 'low',
        trend: -9,
        categories: [
            { label: 'Lixo', value: 34, color: '#8b6328' },
            { label: 'Arv.', value: 30, color: '#63a93a' },
            { label: 'Alag.', value: 20, color: '#2469d6' },
            { label: 'Fogo', value: 16, color: '#d62727' },
        ],
    },
];

const zones = [
    { name: 'Zona Leste', reports: 372, investment: 'R$ 420 mil', color: '#d62727' },
    { name: 'Zona Norte', reports: 196, investment: 'R$ 890 mil', color: '#f37d22' },
    { name: 'Zona Sul', reports: 156, investment: 'R$ 580 mil', color: '#f2c94c' },
    { name: 'Zona Oeste', reports: 98, investment: 'R$ 1,2 mi', color: '#63a93a' },
    { name: 'Centro', reports: 244, investment: 'R$ 310 mil', color: '#f37d22' },
];

const historyRows = [
    ['Bras', 66, 68, 72, 76, 81, 87, 91, 'critical'],
    ['Vila Madalena', 67, 70, 73, 78, 81, 83, 88, 'critical'],
    ['Pinheiros', 62, 65, 64, 68, 69, 70, 71, 'high'],
    ['Mooca', 49, 51, 56, 59, 61, 64, 67, 'high'],
    ['Consolação', 45, 44, 46, 48, 51, 50, 49, 'medium'],
];

let sortMode = 'vulnerability';

function formatMoney(value) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    });
}

function getSortedData() {
    const query = document.querySelector('#ranking-search').value.trim().toLowerCase();
    return [...neighborhoods]
        .filter((item) => item.name.toLowerCase().includes(query))
        .sort((a, b) => {
            if (sortMode === 'investment') return a.investment - b.investment;
            return b.score - a.score;
        });
}

function trendMarkup(value) {
    if (value > 0) return `<span class="trend up">&uarr; +${value}%</span>`;
    if (value < 0) return `<span class="trend down">&darr; ${Math.abs(value)}%</span>`;
    return '<span class="trend flat">&rarr; 0%</span>';
}

function renderTable() {
    const body = document.querySelector('#ranking-body');
    const data = getSortedData();
    const maxReports = Math.max(...neighborhoods.map((item) => item.reports));

    body.innerHTML = data.map((item, index) => {
        const width = Math.max(18, Math.round((item.reports / maxReports) * 100));
        const pos = index + 1;
        const detailHref = item.name === 'BrÃ¡s' ? 'bairro-bras.html' : item.name === 'Pinheiros' ? 'bairro-pinheiros.html' : '#';

        return `
            <tr>
                <td><span class="position ${pos <= 2 ? 'top' : ''}">${pos}</span></td>
                <td>
                    <strong class="bairro-name">${item.name}</strong>
                    <span class="bairro-city">${item.city}</span>
                </td>
                <td>
                    <span class="reports-cell">
                        <span class="mini-bar"><span style="width:${width}%;background:${getToneColor(item.tone)}"></span></span>
                        <strong>${item.reports}</strong>
                    </span>
                </td>
                <td><span class="money">${formatMoney(item.investment)}</span></td>
                <td><strong class="score-pill tone-${item.tone} tone-${item.tone}-bg">${item.score}</strong></td>
                <td><span class="badge tone-${item.tone}-bg">${item.classification}</span></td>
                <td>${trendMarkup(item.trend)}</td>
                <td><a class="row-action" href="${detailHref}">Ver bairro -></a></td>
            </tr>
        `;
    }).join('');
}

function renderChart() {
    const svg = document.querySelector('#ranking-chart');
    const data = getSortedData();
    const width = 980;
    const height = 300;
    const baseY = 242;
    const chartHeight = 190;
    const left = 34;
    const groupWidth = 106;
    const maxScore = Math.max(...data.map((item) => item.score));
    const maxInvestment = Math.max(...data.map((item) => item.investment));

    const groups = data.map((item, index) => {
        const x = left + index * groupWidth;
        const scoreHeight = Math.round((item.score / maxScore) * chartHeight);
        const investmentHeight = Math.round((item.investment / maxInvestment) * chartHeight);
        const scoreY = baseY - scoreHeight;
        const investmentY = baseY - investmentHeight;

        return `
            <g>
                <rect x="${x}" y="${scoreY}" width="34" height="${scoreHeight}" rx="2" fill="${item.tone === 'critical' ? '#d62727' : item.tone === 'high' ? '#f37d22' : item.tone === 'medium' ? '#f2c94c' : '#1a9651'}"></rect>
                <rect x="${x + 42}" y="${investmentY}" width="34" height="${investmentHeight}" rx="2" fill="#1a9651"></rect>
                <text x="${x + 17}" y="${scoreY - 8}" text-anchor="middle" fill="#48525f" font-size="10" font-weight="700">${item.score}</text>
                <text x="${x + 59}" y="${investmentY - 8}" text-anchor="middle" fill="#48525f" font-size="10" font-weight="700">${Math.round(item.investment / 1000)}K</text>
                <text x="${x + 38}" y="268" text-anchor="middle" fill="#8b96a3" font-size="10">${item.name.split(' ')[0]}</text>
            </g>
        `;
    }).join('');

    svg.innerHTML = `
        <line x1="${left}" y1="${baseY}" x2="880" y2="${baseY}" stroke="#e3e8ec"></line>
        ${groups}
    `;
}

function getToneColor(tone) {
    return {
        critical: '#d62727',
        high: '#f37d22',
        medium: '#f2c94c',
        low: '#1a9651',
    }[tone] || '#1a9651';
}

function renderZones() {
    const list = document.querySelector('#zone-list');
    list.innerHTML = zones.map((zone) => `
        <li>
            <i style="background:${zone.color}" aria-hidden="true"></i>
            <span><strong>${zone.name}</strong><br>${zone.investment}</span>
            <strong>${zone.reports}</strong>
        </li>
    `).join('');
}

function renderHistory() {
    const body = document.querySelector('#history-body');
    body.innerHTML = historyRows.map((row) => {
        const [name, ...scores] = row;
        const tone = scores.pop();
        const cells = scores.map((score, index) => {
            if (index === scores.length - 1) {
                return `<td><span class="badge tone-${tone}-bg">${score}</span></td>`;
            }
            return `<td>${score}</td>`;
        }).join('');

        return `<tr><td><strong>${name}</strong></td>${cells}</tr>`;
    }).join('');
}

function renderCategories() {
    const grid = document.querySelector('#category-grid');
    grid.innerHTML = neighborhoods.slice(0, 4).map((item) => {
        const dominant = item.categories.reduce((winner, category) => category.value > winner.value ? category : winner);
        const stack = item.categories.map((category) => `<span style="width:${category.value}%;background:${category.color}"></span>`).join('');
        const legend = item.categories.map((category) => `
            <li><i style="background:${category.color}" aria-hidden="true"></i>${category.label} ${category.value}%</li>
        `).join('');

        return `
            <article class="category-card">
                <h3>${item.name}</h3>
                <p>Distribuição de relatos</p>
                <div class="stacked" aria-label="Distribuição por categoria">${stack}</div>
                <ul class="category-legend">${legend}</ul>
                <p class="dominant">
                    Categoria dominante:
                    <strong style="background:${dominant.color}1f;color:${dominant.color}">${dominant.label}</strong>
                    <b style="color:${dominant.color}">${dominant.value}%</b>
                </p>
                <p class="category-total">${item.reports} relatos abertos</p>
            </article>
        `;
    }).join('');
}

function bindControls() {
    document.querySelectorAll('[data-sort]').forEach((button) => {
        button.addEventListener('click', () => {
            sortMode = button.dataset.sort;
            document.querySelectorAll('[data-sort]').forEach((item) => {
                const isActive = item === button;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-pressed', String(isActive));
            });
            renderTable();
            renderChart();
        });
    });

    document.querySelectorAll('.period').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.period').forEach((item) => {
                const isActive = item === button;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-pressed', String(isActive));
            });
        });
    });

    document.querySelector('#ranking-search').addEventListener('input', renderTable);
}

bindControls();
renderTable();
renderChart();
renderZones();
renderHistory();
renderCategories();
