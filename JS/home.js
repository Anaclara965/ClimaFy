document.addEventListener("DOMContentLoaded", () => {
    console.log("ClimaFy Home inicializada.");

    const heroMockData = {
        reports: 1247,
        neighborhoods: 48,
        cities: 12
    };

    const heroSection = document.querySelector(".hero-section");
    const mapButton = document.querySelector('.hero-buttons a[href="#mapa"]');

    if (heroSection) {
        heroSection.dataset.reports = heroMockData.reports;
        heroSection.dataset.neighborhoods = heroMockData.neighborhoods;
        heroSection.dataset.cities = heroMockData.cities;
    }

    if (mapButton) {
        mapButton.addEventListener("click", (event) => {
            event.preventDefault();
            document.querySelector("#mapa")?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        });
    }

    const mapMarkers = document.querySelectorAll(".map-marker");
    const mapCard = document.querySelector(".map-card");

    mapMarkers.forEach((marker) => {
        marker.addEventListener("click", () => {
            mapMarkers.forEach((item) => item.classList.remove("is-active"));
            marker.classList.add("is-active");

            if (mapCard) {
                mapCard.innerHTML = `
                    <span class="map-card-tag">Ocorr&ecirc;ncia selecionada</span>
                    <strong>${marker.dataset.title}</strong>
                    <p>${marker.dataset.place}</p>
                    <small>Status: ${marker.dataset.status}</small>
                `;
            }
        });
    });

    // Atualizado: Seleciona todos os links da navegaÃ§Ã£o
    const navLinks = document.querySelectorAll('.main-nav a');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove a classe 'active' de todos os links da navegaÃ§Ã£o
            navLinks.forEach(nav => nav.classList.remove('active'));

            // Adiciona a classe 'active' ao link clicado
            this.classList.add('active');

            // Verifica se o link Ã© uma Ã¢ncora interna
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(href);

                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    const upvoteButtons = document.querySelectorAll('.upvotes');

    upvoteButtons.forEach(btn => {
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', function() {
            let currentText = this.innerHTML;
            let currentNumber = parseInt(currentText.replace(/[^0-9]/g, ''));

            if (this.classList.contains('voted')) {
                this.classList.remove('voted');
                this.style.color = 'var(--text-gray)';
                currentNumber--;
            } else {
                this.classList.add('voted');
                this.style.color = 'var(--primary-green)';
                currentNumber++;
            }

            this.innerHTML = `<i class="ph-fill ph-caret-up"></i> ${currentNumber}`;
        });
    });

    carregarDadosPublicosNaHome();
});

const formatoCompacto = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
});

let ocorrenciasExibidasNoMapa = [];
let temporizadorDeRedimensionamento;

function criarItemDeEstatistica(valor, titulo, detalhe) {
    const artigo = document.createElement('article');
    const termo = document.createElement('dt');
    const descricao = document.createElement('dd');
    const destaque = document.createElement('strong');

    artigo.className = 'stat-item';
    termo.textContent = valor;
    destaque.textContent = titulo;
    descricao.append(destaque, document.createElement('br'), detalhe);
    artigo.append(termo, descricao);
    return artigo;
}

function renderizarResumoDaHome(resumo) {
    const lista = document.querySelector('.stats-grid');
    lista.replaceChildren(
        criarItemDeEstatistica(resumo.ocorrencias, 'Ocorrências oficiais', 'alagamentos em 2026'),
        criarItemDeEstatistica(resumo.areasComOcorrencias, 'Áreas com ocorrências', 'subprefeituras identificadas'),
        criarItemDeEstatistica(resumo.areasMonitoradas, 'Áreas monitoradas', 'com orçamento declarado'),
        criarItemDeEstatistica(formatoCompacto.format(resumo.orcamentoRealizado), 'Orçamento realizado', 'total das subprefeituras'),
        criarItemDeEstatistica('2', 'Bases públicas cruzadas', 'Defesa Civil e orçamento'),
    );
}

function renderizarRankingDaHome(ranking) {
    const areaDosCartoes = document.querySelector('.ranking-cards');
    const ordenados = [...ranking]
        .sort((primeiro, segundo) => segundo.indice - primeiro.indice)
        .slice(0, 3);
    areaDosCartoes.replaceChildren();

    ordenados.forEach((item, indice) => {
        const cartao = document.createElement('article');
        const cabecalho = document.createElement('header');
        const posicao = document.createElement('span');
        const classificacao = document.createElement('span');
        const titulo = document.createElement('h3');
        const cidade = document.createElement('p');
        const score = document.createElement('section');
        const rotulo = document.createElement('small');
        const medidor = document.createElement('meter');
        const valor = document.createElement('strong');
        const metricas = document.createElement('dl');
        const ocorrencias = document.createElement('article');
        const orcamento = document.createElement('article');
        const link = document.createElement('a');

        cartao.className = `bairro-card border-${item.tom === 'critical' ? 'red' : 'orange'}`;
        cabecalho.className = 'card-top';
        posicao.className = 'rank-pos';
        posicao.textContent = `#${indice + 1}`;
        classificacao.className = `status-tag ${item.tom === 'critical' ? 'tag-red' : 'tag-orange'}`;
        classificacao.textContent = item.classificacao.toUpperCase();
        cabecalho.append(posicao, classificacao);

        titulo.textContent = item.nome;
        cidade.className = 'city-name';
        cidade.textContent = 'São Paulo, SP';

        score.className = 'score-section';
        rotulo.textContent = 'Índice de prioridade';
        medidor.value = item.indice;
        medidor.min = 0;
        medidor.max = 100;
        medidor.className = item.tom === 'critical' ? 'meter-red' : 'meter-orange';
        valor.textContent = `${item.indice}/100`;
        score.append(rotulo, medidor, valor);

        metricas.className = 'card-stats';
        ocorrencias.innerHTML = `<dt>${item.ocorrencias}</dt><dd>Ocorrências oficiais</dd>`;
        orcamento.innerHTML = `<dt>${formatoCompacto.format(item.realizado)}</dt><dd>Orçamento realizado</dd>`;
        metricas.append(ocorrencias, orcamento);

        link.className = 'btn-outline-small';
        link.href = 'HTML/ranking.html';
        link.textContent = 'Ver no ranking →';
        cartao.append(cabecalho, titulo, cidade, score, metricas, link);
        areaDosCartoes.append(cartao);
    });
}

function converterCoordenadasParaMapa(ponto) {
    const esquerda = 6 + ((ponto.longitude + 46.84) / 0.48) * 78;
    const topo = 6 + ((-23.35 - ponto.latitude) / 0.67) * 86;
    return {
        esquerda: Math.min(84, Math.max(6, esquerda)),
        topo: Math.min(92, Math.max(6, topo)),
    };
}

function obterAreasReservadasDoMapa(mapa) {
    const limiteDoMapa = mapa.getBoundingClientRect();
    const componentes = [
        mapa.querySelector('.map-toolbar'),
        mapa.querySelector('.map-controls'),
        mapa.querySelector('.map-card'),
        mapa.closest('.hero-map')?.querySelector('.map-legend'),
    ].filter(Boolean);

    return componentes.map((componente) => {
        const limite = componente.getBoundingClientRect();
        const respiro = 18;
        return {
            esquerda: limite.left - limiteDoMapa.left - respiro,
            direita: limite.right - limiteDoMapa.left + respiro,
            topo: limite.top - limiteDoMapa.top - respiro,
            base: limite.bottom - limiteDoMapa.top + respiro,
        };
    });
}

function afastarPontoDaInterface(ponto, areas, largura, altura) {
    const margem = 20;
    const ajustado = { ...ponto };

    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
        areas.forEach((area) => {
        const estaDentro =
            ajustado.x > area.esquerda &&
            ajustado.x < area.direita &&
            ajustado.y > area.topo &&
            ajustado.y < area.base;

        if (!estaDentro) {
            return;
        }

        const candidatos = [
            {
                valor: Math.abs(ajustado.x - area.esquerda),
                eixo: 'x',
                destino: area.esquerda,
                valido: area.esquerda >= margem,
            },
            {
                valor: Math.abs(area.direita - ajustado.x),
                eixo: 'x',
                destino: area.direita,
                valido: area.direita <= largura - margem,
            },
            {
                valor: Math.abs(ajustado.y - area.topo),
                eixo: 'y',
                destino: area.topo,
                valido: area.topo >= margem,
            },
            {
                valor: Math.abs(area.base - ajustado.y),
                eixo: 'y',
                destino: area.base,
                valido: area.base <= altura - margem,
            },
        ];
        const candidatosValidos = candidatos
            .filter((candidato) => candidato.valido)
            .sort((primeira, segunda) => primeira.valor - segunda.valor);
        const distanciasSeguras = candidatosValidos
            .filter((candidato) => {
                const xFinal = candidato.eixo === 'x' ? candidato.destino : ajustado.x;
                const yFinal = candidato.eixo === 'y' ? candidato.destino : ajustado.y;
                return !areas.some((outraArea) => (
                    xFinal > outraArea.esquerda &&
                    xFinal < outraArea.direita &&
                    yFinal > outraArea.topo &&
                    yFinal < outraArea.base
                ));
            });
        const distancias = distanciasSeguras.length ? distanciasSeguras : candidatosValidos;

        if (distancias.length) {
            ajustado[distancias[0].eixo] = distancias[0].destino;
        }
        });
    }

    ajustado.x = Math.min(largura - margem, Math.max(margem, ajustado.x));
    ajustado.y = Math.min(altura - margem, Math.max(margem, ajustado.y));
    return ajustado;
}

function agruparPontosProximos(pontos, distanciaMinima) {
    return pontos.reduce((grupos, ponto) => {
        const grupoProximo = grupos.find((grupo) => (
            Math.hypot(grupo.x - ponto.x, grupo.y - ponto.y) < distanciaMinima
        ));

        if (!grupoProximo) {
            grupos.push({ x: ponto.x, y: ponto.y, ocorrencias: [ponto.ocorrencia] });
            return grupos;
        }

        const quantidadeAnterior = grupoProximo.ocorrencias.length;
        grupoProximo.x = ((grupoProximo.x * quantidadeAnterior) + ponto.x) / (quantidadeAnterior + 1);
        grupoProximo.y = ((grupoProximo.y * quantidadeAnterior) + ponto.y) / (quantidadeAnterior + 1);
        grupoProximo.ocorrencias.push(ponto.ocorrencia);
        return grupos;
    }, []);
}

function separarGruposSobrepostos(grupos, areas, largura, altura, distanciaMinima) {
    const separados = grupos.map((grupo) => ({ ...grupo }));

    for (let ciclo = 0; ciclo < 8; ciclo += 1) {
        for (let primeiro = 0; primeiro < separados.length; primeiro += 1) {
            for (let segundo = primeiro + 1; segundo < separados.length; segundo += 1) {
                const grupoA = separados[primeiro];
                const grupoB = separados[segundo];
                const deltaX = grupoB.x - grupoA.x;
                const deltaY = grupoB.y - grupoA.y;
                const distancia = Math.hypot(deltaX, deltaY);

                if (distancia >= distanciaMinima) {
                    continue;
                }

                const angulo = distancia === 0
                    ? ((primeiro + segundo) * Math.PI) / 4
                    : Math.atan2(deltaY, deltaX);
                const deslocamento = ((distanciaMinima - distancia) / 2) + 1;
                const moverX = Math.cos(angulo) * deslocamento;
                const moverY = Math.sin(angulo) * deslocamento;
                grupoA.x -= moverX;
                grupoA.y -= moverY;
                grupoB.x += moverX;
                grupoB.y += moverY;
            }
        }

        separados.forEach((grupo) => {
            const centroSeguro = afastarPontoDaInterface(grupo, areas, largura, altura);
            grupo.x = centroSeguro.x;
            grupo.y = centroSeguro.y;
        });
    }

    return separados;
}

function renderizarPontosOficiais(ocorrencias) {
    const mapa = document.querySelector('#interactive-map');
    const cartao = mapa.querySelector('.map-card');
    const largura = mapa.clientWidth;
    const altura = mapa.clientHeight;

    if (!largura || !altura) {
        return;
    }

    ocorrenciasExibidasNoMapa = ocorrencias;
    mapa.querySelectorAll('.map-marker').forEach((marcador) => marcador.remove());

    const areasReservadas = obterAreasReservadasDoMapa(mapa);
    const pontos = ocorrencias.map((ocorrencia) => {
        const posicao = converterCoordenadasParaMapa(ocorrencia.ponto);
        return afastarPontoDaInterface({
            x: (posicao.esquerda / 100) * largura,
            y: (posicao.topo / 100) * altura,
            ocorrencia,
        }, areasReservadas, largura, altura);
    });
    const gruposSeguros = agruparPontosProximos(pontos, 38).map((grupo) => {
        const centroSeguro = afastarPontoDaInterface(
            { x: grupo.x, y: grupo.y },
            areasReservadas,
            largura,
            altura,
        );
        return { ...grupo, x: centroSeguro.x, y: centroSeguro.y };
    });
    const grupos = separarGruposSobrepostos(
        gruposSeguros,
        areasReservadas,
        largura,
        altura,
        42,
    );

    grupos.forEach((grupo) => {
        const marcador = document.createElement('button');
        const ponto = document.createElement('span');
        const quantidade = grupo.ocorrencias.length;
        const primeiraOcorrencia = grupo.ocorrencias[0];
        const nomes = [...new Set(grupo.ocorrencias.map((ocorrencia) => ocorrencia.nome))];

        marcador.className = quantidade > 1
            ? 'map-marker marker-blue map-cluster'
            : 'map-marker marker-blue';
        marcador.type = 'button';
        marcador.style.setProperty('--x', `${grupo.x}px`);
        marcador.style.setProperty('--y', `${grupo.y}px`);
        marcador.setAttribute(
            'aria-label',
            quantidade > 1
                ? `${quantidade} alagamentos oficiais agrupados. Ativar para ver o resumo.`
                : `Alagamento oficial em ${primeiraOcorrencia.nome}`,
        );
        ponto.textContent = quantidade > 1 ? `+${quantidade}` : '';
        marcador.append(ponto);
        marcador.addEventListener('click', () => {
            mapa.querySelectorAll('.map-marker').forEach((item) => item.classList.remove('is-active'));
            marcador.classList.add('is-active');
            cartao.innerHTML = `
                <span class="map-card-tag">Ocorrência oficial</span>
                <strong>${quantidade > 1 ? `${quantidade} ocorrências agrupadas` : 'Alagamento'}</strong>
                <p>${nomes.slice(0, 3).join(', ')}${nomes.length > 3 ? ` e mais ${nomes.length - 3} áreas` : ''}</p>
                <small>Fonte: Defesa Civil / GeoSampa</small>
            `;
        });
        mapa.insertBefore(marcador, cartao);
    });
}

window.addEventListener('resize', () => {
    window.clearTimeout(temporizadorDeRedimensionamento);
    temporizadorDeRedimensionamento = window.setTimeout(() => {
        if (ocorrenciasExibidasNoMapa.length) {
            renderizarPontosOficiais(ocorrenciasExibidasNoMapa);
        }
    }, 160);
});

async function carregarDadosPublicosNaHome() {
    try {
        const resultado = await window.ClimaFyDados.carregarCruzamento({ periodo: 'ano' });
        renderizarResumoDaHome(resultado.resumo);
        renderizarRankingDaHome(resultado.ranking);

        const monitoramento = document.querySelector('.map-toolbar span');
        if (monitoramento) {
            monitoramento.textContent = `${resultado.resumo.areasMonitoradas} subprefeituras monitoradas`;
        }

        renderizarPontosOficiais(resultado.ocorrencias);
        if (document.fonts?.ready) {
            await document.fonts.ready;
            renderizarPontosOficiais(resultado.ocorrencias);
        }
    } catch (erro) {
        console.error('Não foi possível carregar os CSVs públicos.', erro);
    }
}
