(function iniciarModuloDeDados() {
    const pastaDados = new URL('../DADOS/', document.currentScript.src);
    const arquivos = {
        alagamentos: new URL('alagamentos_defesa_civil_sp_2026.csv', pastaDados),
        orcamento: new URL('orcamento_subprefeituras_sp_2026.csv', pastaDados),
    };

    const aliases = new Map([
        ['sao miguel paulista', 'sao miguel'],
        ['mboi mirim', 'm boi mirim'],
        ['casa verde cachoeirinha', 'casa verde'],
    ]);

    let promessaDosDados;

    function lerCSV(texto, separador) {
        const linhas = [];
        let linha = [];
        let campo = '';
        let entreAspas = false;
        const conteudo = texto.replace(/^\uFEFF/, '');

        for (let indice = 0; indice < conteudo.length; indice += 1) {
            const caractere = conteudo[indice];
            const proximo = conteudo[indice + 1];

            if (caractere === '"') {
                if (entreAspas && proximo === '"') {
                    campo += '"';
                    indice += 1;
                } else {
                    entreAspas = !entreAspas;
                }
            } else if (caractere === separador && !entreAspas) {
                linha.push(campo);
                campo = '';
            } else if ((caractere === '\n' || caractere === '\r') && !entreAspas) {
                if (caractere === '\r' && proximo === '\n') indice += 1;
                linha.push(campo);
                if (linha.some((valor) => valor !== '')) linhas.push(linha);
                linha = [];
                campo = '';
            } else {
                campo += caractere;
            }
        }

        if (campo || linha.length) {
            linha.push(campo);
            linhas.push(linha);
        }

        const [cabecalhos = [], ...registros] = linhas;
        return registros.map((registro) => Object.fromEntries(
            cabecalhos.map((cabecalho, indice) => [
                cabecalho.trim(),
                registro[indice]?.trim() || '',
            ]),
        ));
    }

    function normalizarNome(valor = '') {
        const semCodigo = valor.replace(/^[A-Z]{1,2}\s*-\s*/i, '');
        const normalizado = semCodigo
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/['’]/g, ' ')
            .replace(/[/_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        return aliases.get(normalizado) || normalizado;
    }

    function converterNumero(valor) {
        const numero = Number(String(valor || '').replace(',', '.'));
        return Number.isFinite(numero) ? numero : 0;
    }

    function converterPonto(valor) {
        const resultado = String(valor).match(
            /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i,
        );

        if (!resultado) return null;
        return {
            longitude: Number(resultado[1]),
            latitude: Number(resultado[2]),
        };
    }

    function classificar(indice) {
        if (indice >= 75) return { classificacao: 'Crítica', tom: 'critical' };
        if (indice >= 50) return { classificacao: 'Alta', tom: 'high' };
        if (indice >= 25) return { classificacao: 'Média', tom: 'medium' };
        return { classificacao: 'Baixa', tom: 'low' };
    }

    function obterInicioDoPeriodo(ocorrencias, periodo) {
        const dias = { '7d': 7, '30d': 30, '90d': 90 }[periodo];
        if (!dias) return null;

        const ultimaData = Math.max(...ocorrencias.map((item) => item.data.getTime()));
        return new Date(ultimaData - (dias - 1) * 24 * 60 * 60 * 1000);
    }

    async function baixarCSV(endereco, separador) {
        const resposta = await fetch(endereco);
        if (!resposta.ok) throw new Error(`Falha ao carregar ${endereco.pathname}`);
        return lerCSV(await resposta.text(), separador);
    }

    async function carregarArquivos() {
        const [linhasDoOrcamento, linhasDeAlagamento] = await Promise.all([
            baixarCSV(arquivos.orcamento, ';'),
            baixarCSV(arquivos.alagamentos, ','),
        ]);

        const orcamentos = linhasDoOrcamento.map((linha) => ({
            chave: normalizarNome(linha['Órgão']),
            execucao: converterNumero(linha['Executado (%)']),
            nome: linha['Órgão'],
            previsto: converterNumero(linha['Valor previsto para 2026']),
            realizado: converterNumero(linha.Realizado),
        }));

        const ocorrencias = linhasDeAlagamento.map((linha) => ({
            chave: normalizarNome(linha.nm_subprefeitura),
            data: new Date(`${linha.dt_ocorrencia}T12:00:00`),
            identificador: linha.cd_identificador,
            nome: linha.nm_subprefeitura.replace(/^[A-Z]{1,2}\s*-\s*/i, ''),
            ponto: converterPonto(linha.ge_ponto),
        })).filter((item) => item.ponto && !Number.isNaN(item.data.getTime()));

        return { ocorrencias, orcamentos };
    }

    async function carregarCruzamento(opcoes = {}) {
        if (!promessaDosDados) promessaDosDados = carregarArquivos();
        const { ocorrencias, orcamentos } = await promessaDosDados;
        const inicioDoPeriodo = obterInicioDoPeriodo(ocorrencias, opcoes.periodo);
        const ocorrenciasFiltradas = inicioDoPeriodo
            ? ocorrencias.filter((item) => item.data >= inicioDoPeriodo)
            : ocorrencias;
        const quantidades = new Map();

        ocorrenciasFiltradas.forEach((item) => {
            quantidades.set(item.chave, (quantidades.get(item.chave) || 0) + 1);
        });

        const maiorQuantidade = Math.max(1, ...quantidades.values());
        const investimentos = orcamentos.map((item) => item.realizado);
        const menorInvestimento = Math.min(...investimentos);
        const maiorInvestimento = Math.max(...investimentos);
        const intervalo = Math.max(1, maiorInvestimento - menorInvestimento);

        const ranking = orcamentos.map((orcamento) => {
            const quantidade = quantidades.get(orcamento.chave) || 0;
            const ocorrenciasNormalizadas = quantidade / maiorQuantidade;
            const deficit = (maiorInvestimento - orcamento.realizado) / intervalo;
            const indice = quantidade === 0
                ? 0
                : Math.round((ocorrenciasNormalizadas * 0.65 + deficit * 0.35) * 100);

            return {
                ...classificar(indice),
                execucao: orcamento.execucao,
                indice,
                nome: orcamento.nome,
                ocorrencias: quantidade,
                previsto: orcamento.previsto,
                realizado: orcamento.realizado,
                valorPorOcorrencia: quantidade ? orcamento.realizado / quantidade : null,
            };
        });

        return {
            ocorrencias: ocorrenciasFiltradas,
            ranking,
            resumo: {
                areasComOcorrencias: new Set(ocorrencias.map((item) => item.chave)).size,
                areasMonitoradas: orcamentos.length,
                ocorrencias: ocorrencias.length,
                orcamentoRealizado: orcamentos.reduce((total, item) => total + item.realizado, 0),
            },
        };
    }

    window.ClimaFyDados = {
        carregarCruzamento,
        lerCSV,
        normalizarNome,
    };
}());
