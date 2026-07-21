const purposeCards = [
    ['Nossa Missão', 'Nossa missão e preencher a lacuna dos dados climáticos oficiais, transformando cidadãos comuns em coletores ativos de informações ambientais no nível de suas ruas e bairros.', 'MISSÃO', '#1a9651', 'mission'],
    ['Monitoramento Hiperlocal', 'Registrar e visualizar eventos climáticos e impactos ambientais no nível do bairro e da rua.', 'OBJETIVO', '#f4b60d', 'goal'],
    ['Engajamento Comunitário', 'Transformar moradores em agentes ativos de mudança, criando uma rede colaborativa de monitoramento.', 'OBJETIVO', '#f4b60d', 'goal'],
    ['Transparência ública', 'Cruzar relatos da população com portais de transparência para gerar rankings públicos.', 'OBJETIVO', '#f4b60d', 'goal'],
    ['Colaboração', 'A união de relatos individuais constrói uma rede de proteção coletiva.', 'VALORES', '#116b38', 'value'],
    ['Confiabilidade e Rigor', 'Todos os dados passam por moderação para garantir qualidade das informações.', 'VALORES', '#116b38', 'value'],
    ['Justiça Social', 'Direcionar atenção e investimento para comunidades onde o risco climático é crítico.', 'VALORES', '#116b38', 'value'],
];

const steps = [
    ['01', 'Você vê o problema', 'Alagamento, bueiro, queimada, arvore caida ou qualquer evento ambiental.', '#1a9651'],
    ['02', 'Registra no mapa', 'Clique no local exato, escolha a categoria, descreva e envie uma foto.', '#3894d6'],
    ['03', 'Dados são cruzados', 'Seu relato é cruzado com dados de investimento público e vulnerabilidade.', '#f29c12'],
    ['04', 'Pressão por mudança', 'O ranking público evidencia onde falta investimento e ação do poder público.', '#d63b3b'],
];

const tech = [
    ['React 18 + Vite', 'Frontend'],
    ['Leaflet.js', 'Mapas'],
    ['Node.js + Express', 'Backend'],
    ['MySQL 8', 'Banco de Dados'],
    ['JWT Auth', 'Seguranca'],
];

const team = [
    ['Lu', 'Laura Uchôa', 'Frontend + Mapa', 'Frontend'],
    ['S', 'Sophia Ribeiro', 'Frontend + Mapa', 'Frontend'],
    ['G', 'Guilherme Brito', 'Backend + Banco', 'Backend'],
    ['A', 'Ana Clara', 'Backend + Banco', 'Backend'],
    ['B', 'Beatriz Siqueira', 'Negocios + Docs', 'Negocios'],
    ['Lu', 'Lucas Moraes', 'Negocios + Docs', 'Negocios'],
];

document.querySelector('#purpose-grid').innerHTML = purposeCards.map(([title, text, tag, color, type], index) => `
    <article class="purpose-card ${type === 'mission' ? 'mission' : ''} ${type === 'value' ? 'value' : ''}">
        ${type === 'mission' ? '' : `<span class="number">#${Math.min(index, 3)}</span><span class="tag">${tag}</span>`}
        <h3>${title}</h3>
        <p>${text}</p>
    </article>
`).join('');

document.querySelector('#steps-grid').innerHTML = steps.map(([number, title, text, color]) => `
    <li class="step-card" style="--accent:${color}">
        <span class="number">${number}</span>
        <h3>${title}</h3>
        <p>${text}</p>
    </li>
`).join('');

document.querySelector('#tech-grid').innerHTML = tech.map(([name, label]) => `
    <li><strong>${name}</strong><span>${label}</span></li>
`).join('');

document.querySelector('#team-grid').innerHTML = team.map(([initials, name, role, front]) => `
    <article class="member-card">
        <span class="avatar">${initials}</span>
        <h3>${name}</h3>
        <p>${role}</p>
        <span>${front}</span>
    </article>
`).join('');
