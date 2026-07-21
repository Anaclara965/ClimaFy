const categories = [
    ['Alagamento', 68, '#2469d6'],
    ['Lixo Irregular', 15, '#8b6328'],
    ['Calor Extremo', 10, '#f35c22'],
    ['Queimada', 5, '#d62727'],
    ['Outros', 2, '#8b96a3'],
];

const monthly = [
    ['Jun', 38, 120], ['Jul', 52, 132], ['Ago', 35, 68], ['Set', 80, 140],
    ['Out', 95, 82], ['Nov', 110, 76], ['Dez', 130, 65], ['Jan', 118, 55],
    ['Fev', 138, 88], ['Mar', 126, 44], ['Abr', 142, 35], ['Mai', 139, 28],
];

const deficit = [
    ['Drenagem urbana', 16000, 100000],
    ['Pavimentação', 42000, 80000],
    ['Coleta de residuos', 64000, 90000],
];

const scoreFactors = [
    ['Relatos em aberto', 'Peso: 60%', 147, 200, 53, '#d62727'],
    ['Déficit de invest.', 'Peso: 40%', 76, 100, 38, '#f37d22'],
];

const timeline = [
    ['Alagamento', 'Rua do Gasometro alagada', 'Há 2 horas', 'Aberto', '#2469d6'],
    ['Lixo Irregular', 'Entulho bloqueando calcada', 'Há 5 horas', 'Em andamento', '#8b6328'],
    ['Alagamento', 'Bueiro entupido Av. Rangel Pestana', 'Há 1 dia', 'Aberto', '#2469d6'],
    ['Calor Extremo', 'Praça sem sombra ou água', 'Há 2 dias', 'Aberto', '#f35c22'],
    ['Queimada', 'Vegetação queimando próximo aos trilhos', 'Há 3 dias', 'Resolvido', '#d62727'],
];

const related = [
    ['Mooca', 'ALTA', 67, '82 relatos · R$ 290K investidos', '#f37d22'],
    ['Pinheiros', 'ALTA', 71, '94 relatos · R$ 380K investidos', '#f37d22'],
    ['Consolacao', 'MEDIA', 48, '61 relatos · R$ 450K investidos', '#f4b60d'],
    ['Perdizes', 'BAIXA', 21, '28 relatos · R$ 680K investidos', '#1a9651'],
];

function renderCategoryChart() {
    document.querySelector('#category-chart').innerHTML = categories.map(([label, value, color]) => `
        <div class="category-row" style="--color:${color}">
            <span>${label}</span>
            <span class="bar-bg"><span class="bar-fill" style="width:${value}%"></span></span>
            <strong>${value}%</strong>
        </div>
    `).join('');
}

function renderMonthlyChart() {
    const svg = document.querySelector('#monthly-chart');
    const baseY = 204;
    const chartHeight = 150;
    const left = 34;
    const gap = 63;
    const maxReports = 150;
    const maxInvestment = 150;
    const points = monthly.map(([, , investment], index) => {
        const x = left + index * gap + 18;
        const y = baseY - (investment / maxInvestment) * chartHeight;
        return [x, y];
    });
    const polyline = points.map(([x, y]) => `${x},${y}`).join(' ');
    const bars = monthly.map(([month, reports], index) => {
        const x = left + index * gap;
        const h = (reports / maxReports) * chartHeight;
        return `
            <rect x="${x}" y="${baseY - h}" width="36" height="${h}" rx="3" fill="#d62727"></rect>
            <text x="${x + 18}" y="229" text-anchor="middle" fill="#8b96a3" font-size="9">${month}</text>
        `;
    }).join('');
    const dots = points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#2469d6"></circle>`).join('');

    svg.innerHTML = `
        <line x1="20" y1="${baseY}" x2="800" y2="${baseY}" stroke="#e3e8ec"></line>
        <line x1="20" y1="48" x2="20" y2="${baseY}" stroke="#e3e8ec"></line>
        ${[0, 50, 100, 150].map((tick) => {
            const y = baseY - (tick / maxReports) * chartHeight;
            return `<line x1="20" y1="${y}" x2="800" y2="${y}" stroke="#eff3f5"></line><text x="0" y="${y + 4}" fill="#8b96a3" font-size="10">${tick}</text>`;
        }).join('')}
        ${bars}
        <polyline points="${polyline}" fill="none" stroke="#2469d6" stroke-width="2"></polyline>
        ${dots}
    `;
}

function renderDeficitChart() {
    const max = Math.max(...deficit.map((item) => item[2]));
    document.querySelector('#deficit-chart').innerHTML = deficit.map(([label, invested, required]) => `
        <div class="deficit-row">
            <span>${label}</span>
            <span class="deficit-track">
                <span class="deficit-need" style="width:${(required / max) * 100}%"></span>
                <span class="deficit-invested" style="width:${(invested / max) * 100}%">R$ ${Math.round(invested / 1000)}K</span>
                <span class="deficit-required">R$ ${Math.round(required / 1000)}K</span>
            </span>
        </div>
    `).join('');
}

function statusClass(status) {
    if (status === 'Em andamento') return 'progress';
    if (status === 'Resolvido') return 'done';
    return 'open';
}

function renderScoreBreakdown() {
    const target = document.querySelector('#score-breakdown');
    target.innerHTML = scoreFactors.map(([label, weight, value, max, points, color]) => `
        <section class="score-factor" style="--color:${color}">
            <header><strong>${label}</strong><span>${weight}</span></header>
            <div class="factor-track"><span class="factor-fill" style="width:${(value / max) * 100}%"></span></div>
            <p class="factor-meta"><span>${value} / ${max}</span><strong>+${points} pts</strong></p>
        </section>
    `).join('') + '<p class="total-score">Pontuacao Total <strong>91 / 100</strong></p>';
}

function renderTimeline() {
    document.querySelector('#timeline').innerHTML = timeline.map(([category, title, time, status, color]) => `
        <li style="--color:${color}">
            <span class="dot"></span>
            <article>
                <span class="timeline-badge">${category}</span>
                <h3>${title}</h3>
                <time>${time}</time>
            </article>
            <span class="status ${statusClass(status)}">${status}</span>
        </li>
    `).join('');
}

function renderRelated() {
    document.querySelector('#related-grid').innerHTML = related.map(([name, risk, score, meta, color]) => `
        <article class="related-card" style="--color:${color}">
            <header><h3>${name}</h3><span class="badge">${risk}</span></header>
            <p>${meta}</p>
            <div class="mini"><span style="width:${score}%"></span></div>
            <footer><span>Score ${score}</span><a href="#">Ver -></a></footer>
        </article>
    `).join('');
}

renderCategoryChart();
renderMonthlyChart();
renderDeficitChart();
renderScoreBreakdown();
renderTimeline();
renderRelated();
