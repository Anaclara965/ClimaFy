// Ranking — consome a API pública /api/ranking (contrato: docs/RANKING-API.md).
// A posição (posicao), a ordenação (ordem) e a busca são resolvidas pelo
// servidor: o front não renumera linhas nem recalcula índices/pesos.

const estadoDoRanking = {
    dados: [],
    ordenacao: 'prioridade',
    periodo: 'ano',
    busca: '',
};

let numeroDaConsulta = 0;

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

const formatadorDeData = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
});

const formatadorDeDia = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

function obterCor(tom) {
    return {
        critical: '#d62727',
        high: '#f37d22',
        medium: '#f2c94c',
        low: '#1a9651',
    }[tom] || '#1a9651';
}

function formatarDataHora(texto) {
    if (!texto) return '—';
    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? texto : formatadorDeData.format(data);
}

function formatarDataSimples(texto) {
    if (!texto) return '—';
    const data = new Date(`${texto}T12:00:00`);
    return Number.isNaN(data.getTime()) ? texto : formatadorDeDia.format(data);
}

function definirMensagem(texto, classe) {
    const mensagem = document.querySelector('#data-message');
    mensagem.classList.remove('success', 'error');
    if (classe) mensagem.classList.add(classe);
    mensagem.textContent = texto;
}

function limparVisualizacao() {
    document.querySelector('#ranking-body').replaceChildren();
    document.querySelector('#ranking-chart').replaceChildren();
}

function construirUrl() {
    const parametros = new URLSearchParams({
        periodo: estadoDoRanking.periodo,
        ordem: estadoDoRanking.ordenacao,
    });
    const busca = estadoDoRanking.busca.trim();
    if (busca) parametros.set('busca', busca);
    return `/api/ranking?${parametros.toString()}`;
}

function criarSvgElemento(tag, atributos = {}) {
    const elemento = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(atributos).forEach(([atributo, valor]) => {
        elemento.setAttribute(atributo, valor);
    });
    return elemento;
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
    const dados = estadoDoRanking.dados;
    const maiorQuantidade = Math.max(1, ...dados.map((item) => item.ocorrencias));
    corpo.replaceChildren();

    dados.forEach((item) => {
        const linha = document.createElement('tr');
        const posicao = document.createElement('strong');
        const area = document.createElement('article');
        const ocorrencias = document.createElement('span');
        const barra = document.createElement('span');
        const preenchimento = document.createElement('span');
        const total = document.createElement('strong');
        const indiceVisual = document.createElement('strong');
        const classificacao = document.createElement('span');

        // posicao é a posição global publicada pelo servidor: nunca renumerada aqui.
        posicao.className = `position ${item.posicao <= 2 ? 'top' : ''}`;
        posicao.textContent = item.posicao;

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
    grafico.replaceChildren();

    // O gráfico compara sempre as dez maiores prioridades (por posicao),
    // independentemente da ordenação atual da tabela.
    const dados = [...estadoDoRanking.dados]
        .sort((primeiro, segundo) => primeiro.posicao - segundo.posicao)
        .slice(0, 10);
    if (!dados.length) return;

    const alturaBase = 238;
    const alturaUtil = 180;
    const larguraDoGrupo = 88;
    const maiorIndice = Math.max(1, ...dados.map((item) => item.indice));
    const maiorOrcamento = Math.max(1, ...dados.map((item) => item.realizado));

    dados.forEach((item, indice) => {
        const x = 42 + indice * larguraDoGrupo;
        const alturaIndice = Math.round((item.indice / maiorIndice) * alturaUtil);
        const alturaOrcamento = Math.round((item.realizado / maiorOrcamento) * alturaUtil);
        const nome = item.nome.split(' ')[0];

        const grupo = criarSvgElemento('g');
        const barraIndice = criarSvgElemento('rect', {
            x,
            y: alturaBase - alturaIndice,
            width: 28,
            height: alturaIndice,
            rx: 2,
            fill: obterCor(item.tom),
        });
        const barraOrcamento = criarSvgElemento('rect', {
            x: x + 34,
            y: alturaBase - alturaOrcamento,
            width: 28,
            height: alturaOrcamento,
            rx: 2,
            fill: '#1a9651',
        });
        const rotuloIndice = criarSvgElemento('text', {
            x: x + 14,
            y: alturaBase - alturaIndice - 7,
            'text-anchor': 'middle',
            fill: '#48525f',
            'font-size': '9',
            'font-weight': '700',
        });
        rotuloIndice.textContent = item.indice;
        const rotuloOrcamento = criarSvgElemento('text', {
            x: x + 48,
            y: alturaBase - alturaOrcamento - 7,
            'text-anchor': 'middle',
            fill: '#48525f',
            'font-size': '9',
            'font-weight': '700',
        });
        rotuloOrcamento.textContent = `${Math.round(item.realizado / 1000000)}M`;
        const rotuloNome = criarSvgElemento('text', {
            x: x + 31,
            y: 264,
            'text-anchor': 'middle',
            fill: '#8b96a3',
            'font-size': '9',
        });
        // Nomes vindos do servidor entram por textContent (nunca innerHTML interpolado).
        rotuloNome.textContent = nome;

        grupo.append(barraIndice, barraOrcamento, rotuloIndice, rotuloOrcamento, rotuloNome);
        grafico.append(grupo);
    });

    grafico.append(criarSvgElemento('line', {
        x1: 34,
        y1: alturaBase,
        x2: 940,
        y2: alturaBase,
        stroke: '#e3e8ec',
    }));
}

function renderizarResumo(resumo) {
    const valores = resumo
        ? [
            resumo.areasMonitoradas,
            resumo.ocorrencias,
            formatadorCompacto.format(resumo.orcamentoRealizado),
            resumo.areasComOcorrencias,
        ]
        : ['—', '—', '—', '—'];

    document.querySelectorAll('#ranking-resumo dd').forEach((item, indice) => {
        item.textContent = valores[indice];
    });
}

function renderizarMetodologia(metodologia) {
    const alvo = document.querySelector('#method-reference');
    if (!alvo || !metodologia) return;
    alvo.textContent = `Versão ${metodologia.versao} · Período iniciando em ${formatarDataSimples(metodologia.inicio)} com referência em ${formatarDataSimples(metodologia.referencia)} (última ocorrência do conjunto, não a data de hoje).`;
}

function renderizarFontes(fontes, atualizadoEm) {
    const lista = document.querySelector('#source-list');
    if (!lista || !Array.isArray(fontes)) return;
    lista.replaceChildren();

    fontes.forEach((fonte) => {
        const item = document.createElement('li');
        const icone = document.createElement('i');
        icone.className = 'ph ph-file-csv';
        icone.setAttribute('aria-hidden', 'true');
        const rotulo = document.createElement('span');
        rotulo.textContent = `${fonte.arquivo} — ${fonte.linhas} linhas (SHA-256 ${String(fonte.sha256 || '').slice(0, 12)}…)`;
        item.append(icone, rotulo);
        lista.append(item);
    });

    const nota = document.querySelector('#data-sources-note');
    if (nota) {
        nota.textContent = `Os dados são importados dos CSVs oficiais e publicados via API /api/ranking (publicação de ${formatarDataHora(atualizadoEm)}).`;
    }
}

function atualizarVisualizacao() {
    renderizarTabela();
    renderizarGrafico();
}

async function carregarDados() {
    const consulta = numeroDaConsulta + 1;
    numeroDaConsulta = consulta;
    definirMensagem('Carregando dados oficiais...');

    try {
        const resposta = await fetch(construirUrl(), {
            headers: { Accept: 'application/json' },
        });
        const dados = await resposta.json().catch(() => null);

        // Resposta de uma consulta antiga (usuário trocou filtros rapidamente): ignore.
        if (consulta !== numeroDaConsulta) return;

        if (!resposta.ok) {
            limparVisualizacao();
            estadoDoRanking.dados = [];
            renderizarResumo(null);

            if (resposta.status === 503) {
                definirMensagem(
                    `Indisponibilidade: ${dados?.erro || 'O ranking não está disponível no momento.'}`,
                    'error',
                );
            } else if (resposta.status === 422) {
                definirMensagem(
                    'Filtros do ranking inválidos. Ajuste a busca, a ordem ou o período e tente de novo.',
                    'error',
                );
            } else {
                definirMensagem(
                    `Não foi possível carregar o ranking${dados?.erro ? `: ${dados.erro}` : '.'}`,
                    'error',
                );
            }
            return;
        }

        estadoDoRanking.dados = dados.ranking;
        renderizarResumo(dados.resumo);
        renderizarMetodologia(dados.metodologia);
        renderizarFontes(dados.fontes, dados.atualizadoEm);
        atualizarVisualizacao();

        if (!dados.ranking.length) {
            definirMensagem(
                `Nenhuma subprefeitura corresponde à busca “${estadoDoRanking.busca.trim()}”.`,
            );
        } else {
            definirMensagem(
                `Dados oficiais via API /api/ranking (publicação de ${formatarDataHora(dados.atualizadoEm)}).`,
                'success',
            );
        }
    } catch (erro) {
        if (consulta !== numeroDaConsulta) return;
        limparVisualizacao();
        estadoDoRanking.dados = [];
        renderizarResumo(null);
        definirMensagem(
            'Indisponibilidade: não foi possível consultar o ranking agora. Tente novamente mais tarde.',
            'error',
        );
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
            carregarDados();
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

    let identificadorDaBusca;
    document.querySelector('#ranking-search').addEventListener('input', (evento) => {
        clearTimeout(identificadorDaBusca);
        identificadorDaBusca = setTimeout(() => {
            estadoDoRanking.busca = evento.target.value;
            carregarDados();
        }, 300);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    configurarControles();
    carregarDados();
});
