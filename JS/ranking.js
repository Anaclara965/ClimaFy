const estadoDoRanking = {
    dados: [],
    ordenacao: 'prioridade',
    periodo: 'ano',
};

const formatadorDeDinheiro = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
});

const formatadorCompacto = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
});

function obterCor(tom) {
    return {
        critical: '#d62727',
        high: '#f37d22',
        medium: '#f2c94c',
        low: '#1a9651',
    }[tom] || '#1a9651';
}

function obterDadosVisiveis() {
    const busca = window.ClimaFyDados.normalizarNome(
        document.querySelector('#ranking-search').value,
    );
    const dados = estadoDoRanking.dados.filter((item) => (
        window.ClimaFyDados.normalizarNome(item.nome).includes(busca)
    ));

    return dados.sort((primeiro, segundo) => {
        if (estadoDoRanking.ordenacao === 'orcamento') {
            return primeiro.realizado - segundo.realizado
                || segundo.ocorrencias - primeiro.ocorrencias;
        }

        return segundo.indice - primeiro.indice
            || segundo.ocorrencias - primeiro.ocorrencias;
    });
}

function criarCelula(conteudo) {
    const celula = document.createElement('td');
    if (conteudo instanceof Node) {
        celula.append(conteudo);
    } else {
        celula.textContent = conteudo;
    }
    return celula;
}

function renderizarTabela() {
    const corpo = document.querySelector('#ranking-body');
    const dados = obterDadosVisiveis();
    const maiorQuantidade = Math.max(1, ...dados.map((item) => item.ocorrencias));
    corpo.replaceChildren();

    dados.forEach((item, indice) => {
        const linha = document.createElement('tr');
        const posicao = document.createElement('strong');
        const area = document.createElement('article');
        const ocorrencias = document.createElement('span');
        const barra = document.createElement('span');
        const preenchimento = document.createElement('span');
        const total = document.createElement('strong');
        const indiceVisual = document.createElement('strong');
        const classificacao = document.createElement('span');

        posicao.className = `position ${indice < 2 ? 'top' : ''}`;
        posicao.textContent = indice + 1;

        area.append(
            Object.assign(document.createElement('strong'), {
                className: 'bairro-name',
                textContent: item.nome,
            }),
            Object.assign(document.createElement('span'), {
                className: 'bairro-city',
                textContent: 'São Paulo, SP',
            }),
        );

        preenchimento.style.width = `${Math.round((item.ocorrencias / maiorQuantidade) * 100)}%`;
        preenchimento.style.background = obterCor(item.tom);
        barra.className = 'mini-bar';
        barra.append(preenchimento);
        total.textContent = item.ocorrencias;
        ocorrencias.className = 'reports-cell';
        ocorrencias.append(barra, total);

        indiceVisual.className = `score-pill tone-${item.tom} tone-${item.tom}-bg`;
        indiceVisual.textContent = item.indice;
        classificacao.className = `badge tone-${item.tom}-bg`;
        classificacao.textContent = item.classificacao;

        linha.append(
            criarCelula(posicao),
            criarCelula(area),
            criarCelula(ocorrencias),
            criarCelula(formatadorDeDinheiro.format(item.realizado)),
            criarCelula(`${item.execucao.toFixed(1)}%`),
            criarCelula(indiceVisual),
            criarCelula(classificacao),
            criarCelula(item.valorPorOcorrencia
                ? formatadorDeDinheiro.format(item.valorPorOcorrencia)
                : '—'),
        );
        corpo.append(linha);
    });
}

function renderizarGrafico() {
    const grafico = document.querySelector('#ranking-chart');
    const dados = obterDadosVisiveis().slice(0, 10);
    const alturaBase = 238;
    const alturaUtil = 180;
    const larguraDoGrupo = 88;
    const maiorIndice = Math.max(1, ...dados.map((item) => item.indice));
    const maiorOrcamento = Math.max(1, ...dados.map((item) => item.realizado));

    const grupos = dados.map((item, indice) => {
        const x = 42 + indice * larguraDoGrupo;
        const alturaIndice = Math.round((item.indice / maiorIndice) * alturaUtil);
        const alturaOrcamento = Math.round((item.realizado / maiorOrcamento) * alturaUtil);
        const nome = item.nome.split(' ')[0];

        return `
            <g>
                <rect x="${x}" y="${alturaBase - alturaIndice}" width="28" height="${alturaIndice}" rx="2" fill="${obterCor(item.tom)}"></rect>
                <rect x="${x + 34}" y="${alturaBase - alturaOrcamento}" width="28" height="${alturaOrcamento}" rx="2" fill="#1a9651"></rect>
                <text x="${x + 14}" y="${alturaBase - alturaIndice - 7}" text-anchor="middle" fill="#48525f" font-size="9" font-weight="700">${item.indice}</text>
                <text x="${x + 48}" y="${alturaBase - alturaOrcamento - 7}" text-anchor="middle" fill="#48525f" font-size="9" font-weight="700">${Math.round(item.realizado / 1000000)}M</text>
                <text x="${x + 31}" y="264" text-anchor="middle" fill="#8b96a3" font-size="9">${nome}</text>
            </g>
        `;
    }).join('');

    grafico.innerHTML = `
        <line x1="34" y1="${alturaBase}" x2="940" y2="${alturaBase}" stroke="#e3e8ec"></line>
        ${grupos}
    `;
}

function renderizarResumo(resumo) {
    const valores = [
        resumo.areasMonitoradas,
        resumo.ocorrencias,
        formatadorCompacto.format(resumo.orcamentoRealizado),
        resumo.areasComOcorrencias,
    ];

    document.querySelectorAll('#ranking-resumo dd').forEach((item, indice) => {
        item.textContent = valores[indice];
    });
}

function atualizarVisualizacao() {
    renderizarTabela();
    renderizarGrafico();
}

async function carregarDados() {
    const mensagem = document.querySelector('#data-message');
    mensagem.textContent = 'Carregando dados públicos...';

    try {
        const resultado = await window.ClimaFyDados.carregarCruzamento({
            periodo: estadoDoRanking.periodo,
        });
        estadoDoRanking.dados = resultado.ranking;
        renderizarResumo(resultado.resumo);
        atualizarVisualizacao();
        mensagem.textContent = 'Dados oficiais carregados: Defesa Civil/GeoSampa e orçamento das subprefeituras de 2026.';
        mensagem.classList.add('success');
    } catch (erro) {
        mensagem.textContent = 'Não foi possível ler os CSVs. Abra o projeto por um servidor local para permitir a leitura dos arquivos.';
        mensagem.classList.add('error');
        console.error(erro);
    }
}

function configurarControles() {
    document.querySelectorAll('[data-sort]').forEach((botao) => {
        botao.addEventListener('click', () => {
            estadoDoRanking.ordenacao = botao.dataset.sort;
            document.querySelectorAll('[data-sort]').forEach((item) => {
                const ativo = item === botao;
                item.classList.toggle('active', ativo);
                item.setAttribute('aria-pressed', String(ativo));
            });
            atualizarVisualizacao();
        });
    });

    document.querySelectorAll('[data-periodo]').forEach((botao) => {
        botao.addEventListener('click', () => {
            estadoDoRanking.periodo = botao.dataset.periodo;
            document.querySelectorAll('[data-periodo]').forEach((item) => {
                const ativo = item === botao;
                item.classList.toggle('active', ativo);
                item.setAttribute('aria-pressed', String(ativo));
            });
            carregarDados();
        });
    });

    document.querySelector('#ranking-search').addEventListener('input', atualizarVisualizacao);
}

document.addEventListener('DOMContentLoaded', () => {
    configurarControles();
    carregarDados();
});
