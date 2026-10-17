document.addEventListener("DOMContentLoaded", () => {
    const titleInput = document.getElementById("report-title");
    const descriptionInput = document.getElementById("report-description");
    const titleCount = document.getElementById("title-count");
    const descriptionCount = document.getElementById("description-count");
    const uploadZone = document.getElementById("upload-zone");
    const uploadInput = document.getElementById("photo-upload");
    const uploadFeedback = document.getElementById("upload-feedback");
    const miniMap = document.getElementById("mini-map");
    const latitudeInput = document.getElementById("latitude");
    const longitudeInput = document.getElementById("longitude");
    const coordinates = document.getElementById("coordinates");
    const locationButton = document.getElementById("use-location");
    const locationFeedback = document.getElementById("location-feedback");
    const form = document.getElementById("new-report-form");
    const formFeedback = document.getElementById("form-feedback");
    const submitButton = form.querySelector('button[type="submit"]');
    let enviando = false;
    let relatoEnviado = false;
    let buscandoLocalizacao = false;
    let pausarBuscas = () => {};
    let definirPontoInicial = () => {};
    let edicao;
    try { edicao = form.dataset.inicial ? JSON.parse(form.dataset.inicial) : null; }
    catch {
        submitButton.disabled = true;
        formFeedback.textContent = "Não foi possível carregar a edição. Reabra o relato em Meus relatos.";
        return;
    }
    const bairroInput = document.getElementById("neighborhood");
    const bairroId = document.getElementById("bairro-id");
    const listaBairros = document.getElementById("bairro-resultados");
    const cidadeInput = document.getElementById("city");
    const anexos = window.ClimaFyMidias?.configurarEnvio({
        form, input: uploadInput, zona: uploadZone, feedback: uploadFeedback, edicao,
        remover: document.getElementById("remove-upload"), titulo: document.getElementById("upload-title"),
        ajuda: document.getElementById("upload-help"),
        previa: document.getElementById("upload-preview"),
    });
    if (!anexos) uploadInput.disabled = true;
    let versaoCampos = 0;

    function updateCounter(input, target) {
        target.textContent = input.value.length;
    }

    function selectOption(options, selectedOption) {
        options.forEach((option) => option.classList.remove("is-selected"));
        selectedOption.classList.add("is-selected");
        const input = selectedOption.querySelector("input");
        if (input) {
            input.checked = true;
        }
    }

    titleInput.addEventListener("input", () => updateCounter(titleInput, titleCount));
    descriptionInput.addEventListener("input", () => updateCounter(descriptionInput, descriptionCount));

    const dropdownFields = Array.from(document.querySelectorAll("[data-dropdown]"));

    function setDropdownOpen(field, open) {
        const toggle = field.querySelector(".dropdown-toggle");
        const panel = field.querySelector(".dropdown-panel");
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        field.classList.toggle("is-open", open);
    }

    function syncDropdownLabel(field) {
        const label = field.querySelector(".dropdown-toggle-label");
        const options = Array.from(
            field.querySelectorAll(".category-option, .severity-options label")
        );
        const selected =
            options.find((option) => option.querySelector("input").checked) ||
            options[0];
        const icon = selected.querySelector(".icon");
        const textEl =
            selected.querySelector("strong") ||
            selected.querySelector("span:not(.icon)");

        label.innerHTML = "";
        if (icon) {
            label.appendChild(icon.cloneNode(true));
        }
        const text = document.createElement("span");
        text.className = "dropdown-toggle-text";
        text.textContent = textEl ? textEl.textContent : "";
        label.appendChild(text);
    }

    bairroInput.setCustomValidity("Selecione um bairro da lista.");

    const autocompleteBairros = window.ClimaFyBairros.criarAutocompleteBairros({
        input: bairroInput,
        lista: listaBairros,

        aoEscolher(bairro) {
            versaoCampos++;
            bairroId.value = bairro.id;
            cidadeInput.value = bairro.cidade;
            bairroInput.setCustomValidity("");
        },

        aoLimpar() {
            versaoCampos++;
            bairroId.value = "";
            cidadeInput.value = "";
            bairroInput.setCustomValidity("Selecione um bairro da lista.");
        }
    });

    dropdownFields.forEach((field) => {
        const toggle = field.querySelector(".dropdown-toggle");
        const panel = field.querySelector(".dropdown-panel");
        const options = Array.from(
            field.querySelectorAll(".category-option, .severity-options label")
        );

        toggle.addEventListener("click", () => {
            setDropdownOpen(field, panel.hidden);
        });

        options.forEach((option) => {
            option.addEventListener("click", () => {
                if (enviando || relatoEnviado) return;
                selectOption(options, option);
                syncDropdownLabel(field);
                setDropdownOpen(field, false);
            });
        });

        syncDropdownLabel(field);
    });

    document.addEventListener("click", (event) => {
        dropdownFields.forEach((field) => {
            if (!field.contains(event.target)) {
                setDropdownOpen(field, false);
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            dropdownFields.forEach((field) => setDropdownOpen(field, false));
        }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        uploadZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            uploadZone.classList.add("is-dragging");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        uploadZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            uploadZone.classList.remove("is-dragging");
        });
    });


    if (window.L) {
        // São Paulo é apenas o centro inicial da visualização.
        const mapa = L.map(miniMap, {
            scrollWheelZoom: false
        }).setView([-23.5505, -46.6333], 12);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">' +
                'OpenStreetMap</a> contributors'
        }).addTo(mapa);

        let marcador;
        let versaoLocal = 0;
        let temporizadorLocal;
        let consultaLocal;

        function identificarCidadeBairro(local) {
            clearTimeout(temporizadorLocal);
            consultaLocal?.abort();
            // Um ponto novo invalida o bairro do ponto anterior.
            autocompleteBairros.limpar();
            const versaoDoPonto = versaoLocal;
            const versaoDosCampos = versaoCampos;
            temporizadorLocal = setTimeout(async () => {
                consultaLocal = new AbortController();
                try {
                    const resposta = await fetch("/api/localizacao/ponto", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify({ latitude: local.lat, longitude: local.lng }),
                        signal: consultaLocal.signal
                    });
                    const dados = await resposta.json();
                    // Respostas antigas não sobrescrevem outro ponto ou escolha manual.
                    if (versaoDoPonto !== versaoLocal || versaoDosCampos !== versaoCampos) return;
                    if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível identificar cidade e bairro.");
                    if (dados.bairro) {
                        autocompleteBairros.selecionar(dados.bairro);
                    } else {
                        cidadeInput.value = dados.cidade;
                        bairroInput.value = dados.bairroSugerido;
                        bairroId.value = "";
                        bairroInput.setCustomValidity("Selecione um bairro cadastrado na lista.");
                    }
                    locationFeedback.textContent += " " + dados.mensagem;
                } catch (erro) {
                    if (erro.name === "AbortError" || versaoDoPonto !== versaoLocal || versaoDosCampos !== versaoCampos) return;
                    locationFeedback.textContent += " Não foi possível preencher cidade e bairro agora. Selecione o bairro na lista.";
                }
            }, 700);
        }

        function selecionarLocal(local, identificar = true) {
            if (enviando || relatoEnviado) return;
            versaoLocal++;
            latitudeInput.value = local.lat.toFixed(7);
            longitudeInput.value = local.lng.toFixed(7);

            coordinates.textContent =
                `${local.lat.toFixed(5)}, ${local.lng.toFixed(5)}`;

            if (marcador) {
                marcador.setLatLng(local);
            } else {
                marcador = L.marker(local, {
                    draggable: true,
                    autoPan: true,
                    alt: "Local escolhido para o relato"
                }).addTo(mapa);

                marcador.on("dragend", () => {
                    selecionarLocal(marcador.getLatLng());
                    locationFeedback.textContent = "Marcador ajustado. Confira se corresponde ao local do problema.";
                });
            }
            if (identificar) identificarCidadeBairro(local);
        }

        definirPontoInicial = local => {
            selecionarLocal(local, false);
            mapa.setView(local, 16);
        };

        const buscaEndereco = window.ClimaFyEnderecos.criarBuscaEndereco({
            input: document.getElementById("address-search"),
            lista: document.getElementById("address-results"),
            botao: document.getElementById("search-address"),
            feedback: document.getElementById("address-feedback"),
            aoEscolher(local) {
                const ponto = { lat: local.latitude, lng: local.longitude };
                selecionarLocal(ponto);
                mapa.setView(ponto, 17);
                locationFeedback.textContent = "Endereço localizado. Identificando cidade e bairro… Confira o ponto no mapa.";
            }
        });

        pausarBuscas = () => {
            versaoLocal++;
            clearTimeout(temporizadorLocal);
            consultaLocal?.abort();
            autocompleteBairros.fechar();
            buscaEndereco.fechar();
        };

        mapa.on("click", (evento) => {
            selecionarLocal(evento.latlng);
            locationFeedback.textContent = "Ponto escolhido. Confira se corresponde ao local do problema.";
        });

        locationButton.addEventListener("click", () => {
            if (locationButton.disabled || enviando || relatoEnviado) return;
            if (!window.isSecureContext) {
                locationFeedback.textContent = "Para usar sua localização, abra o site em HTTPS ou localhost. Você pode escolher o ponto no mapa.";
                return;
            }
            if (!navigator.geolocation) {
                locationFeedback.textContent = "Seu navegador não oferece localização. Escolha o ponto no mapa.";
                return;
            }

            // Se a pessoa escolher outro ponto enquanto espera, preserva a escolha.
            const versaoAoPedir = versaoLocal;
            buscandoLocalizacao = true;
            locationButton.disabled = true;
            locationButton.textContent = "Buscando localização…";
            locationFeedback.textContent = "Aguardando sua permissão e a localização do dispositivo.";

            function finalizarBusca() {
                buscandoLocalizacao = false;
                locationButton.disabled = enviando || relatoEnviado;
                locationButton.textContent = "Usar minha localização";
            }

            function falhar(erro) {
                finalizarBusca();
                const mensagens = {
                    1: "Permissão de localização negada. Você pode permiti-la nas configurações do navegador ou escolher o ponto no mapa.",
                    2: "Não foi possível encontrar sua localização. Tente novamente ou escolha o ponto no mapa.",
                    3: "A busca demorou demais. Tente novamente ou escolha o ponto no mapa."
                };
                locationFeedback.textContent = mensagens[erro.code] ?? "Não foi possível usar sua localização. Escolha o ponto no mapa.";
            }

            try {
                navigator.geolocation.getCurrentPosition((posicao) => {
                    finalizarBusca();
                    if (enviando || relatoEnviado || versaoLocal !== versaoAoPedir) {
                        locationFeedback.textContent = "Mantivemos o ponto que você escolheu enquanto a localização era buscada.";
                        return;
                    }
                    const { latitude, longitude, accuracy } = posicao.coords;
                    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
                        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                        falhar({ code: 2 });
                        return;
                    }
                    const local = { lat: latitude, lng: longitude };
                    selecionarLocal(local);
                    mapa.setView(local, 16);
                    const precisao = Number.isFinite(accuracy)
                        ? ` Precisão estimada: ${Math.ceil(accuracy)} metros.` : "";
                    locationFeedback.textContent = "Localização aproximada encontrada." + precisao +
                        " Confira o local do problema e ajuste o marcador se necessário. Identificando cidade e bairro…";
                }, falhar, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                });
            } catch (erro) {
                falhar(erro);
            }
        });

        miniMap.addEventListener("keydown", (evento) => {
            // Atua somente quando o próprio mapa está focado.
            if (evento.target !== miniMap) return;

            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                selecionarLocal(mapa.getCenter());
                locationFeedback.textContent = "Centro do mapa selecionado. Confira se corresponde ao local do problema.";
            }
        });
    } else {
        coordinates.textContent =
            "Não foi possível carregar o mapa. Recarregue a página.";
        locationButton.disabled = true;
        document.getElementById("search-address").disabled = true;
        document.getElementById("address-search").disabled = true;
        locationFeedback.textContent = "Recarregue a página para tentar carregar o mapa novamente.";
    }

    function mostrarResultado(mensagens, tipo, link) {
        formFeedback.replaceChildren();
        formFeedback.dataset.tipo = tipo;
        const lista = document.createElement("ul");
        mensagens.forEach((mensagem) => {
            const item = document.createElement("li");
            item.textContent = mensagem;
            lista.appendChild(item);
        });
        formFeedback.appendChild(lista);
        if (link) {
            const atalho = document.createElement("a");
            atalho.href = link.href;
            atalho.textContent = link.texto;
            formFeedback.appendChild(atalho);
        }
        formFeedback.focus();
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (enviando || relatoEnviado) return;
        if (!form.reportValidity()) return;
        if (!latitudeInput.value.trim() || !longitudeInput.value.trim()) {
            mostrarResultado(["Escolha o local do problema no mapa, pela busca de endereço ou pela localização atual."], "erro");
            miniMap.focus();
            return;
        }
        if (!anexos && uploadInput.files.length) {
            mostrarResultado(["O envio de fotos ainda não está disponível. Retire o arquivo antes de enviar."], "erro");
            return;
        }

        // O payload usa exatamente os nomes esperados pelos validators do servidor.
        const campos = new FormData(form);
        const dados = {};
        ["titulo", "descricao", "categoria", "severidade", "bairro", "latitude", "longitude", "referencia"]
            .forEach((campo) => { dados[campo] = campos.get(campo) ?? ""; });
        if (edicao) dados.versao = edicao.versao;
        let envio;
        try { envio = anexos ? anexos.preparar(dados) : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) }; }
        catch (erro) { mostrarResultado([erro.message], "erro"); return; }

        enviando = true;
        versaoCampos++; // Uma identificação anterior não muda o bairro deste envio.
        pausarBuscas();
        const controles = Array.from(form.querySelectorAll("fieldset, input, textarea, button"))
            .map((controle) => ({ controle, desabilitado: controle.disabled }));
        controles.forEach(({ controle }) => { controle.disabled = true; });
        submitButton.disabled = true;
        submitButton.textContent = "Enviando relato…";
        form.setAttribute("aria-busy", "true");
        formFeedback.replaceChildren();
        delete formFeedback.dataset.tipo;
        try {
            const resposta = await fetch(edicao ? "/api/meus-relatos/" + encodeURIComponent(edicao.publicId) : "/api/relatos", {
                method: edicao ? "PUT" : "POST",
                credentials: "same-origin",
                headers: { ...envio.headers, Accept: "application/json",
                    ...(edicao ? { "X-CSRF-Token": edicao.csrfToken } : {}) },
                body: envio.body
            });
            const corpo = await resposta.json();
            if (!resposta.ok) {
                const mensagens = Array.isArray(corpo.erros)
                    ? corpo.erros.filter((erro) => typeof erro === "string")
                    : [corpo.erro ?? "Não foi possível enviar o relato. Tente novamente."];
                mostrarResultado(mensagens.length ? mensagens : ["Não foi possível enviar o relato."], "erro",
                    resposta.status === 401
                        ? { href: "/login?proximo=" + encodeURIComponent(edicao
                            ? "/meus-relatos/" + edicao.publicId + "/editar" : "/new-report"), texto: "Entrar novamente" } : null);
                return;
            }
            if (resposta.status !== (edicao ? 200 : 201) || corpo.ok !== true || typeof corpo.publicId !== "string" || !corpo.publicId ||
                (edicao && (corpo.publicId !== edicao.publicId || typeof corpo.versao !== "string"))) {
                throw new Error("Resposta de criação não confirmada");
            }
            relatoEnviado = true;
            mostrarResultado([
                edicao ? (corpo.alterado ? "Alterações salvas. O relato aguarda nova moderação."
                    : "Nenhuma alteração no conteúdo. O relato foi mantido.")
                    : "Relato enviado para moderação. Ele aparecerá publicamente depois de ser aprovado.",
                `Identificador do relato: ${corpo.publicId}`
            ], "sucesso", edicao ? { href: "/meus-relatos/" + encodeURIComponent(edicao.publicId), texto: "Consultar meu relato" }
                : { href: "/new-report", texto: "Criar outro relato" });
            // Mantém os dados como recibo e evita repetir o envio nesta tela.
            form.querySelectorAll("input, textarea, button").forEach((controle) => { controle.disabled = true; });
        } catch (erro) {
            mostrarResultado([
                edicao ? "Não conseguimos confirmar a edição. Confira Meus relatos antes de repetir; os dados foram mantidos nesta tela."
                    : "Não conseguimos confirmar o envio. Seu relato pode ter sido registrado; evite reenviar imediatamente. Os dados foram mantidos nesta tela."
            ], "erro");
        } finally {
            enviando = false;
            form.setAttribute("aria-busy", "false");
            if (!relatoEnviado) {
                controles.forEach(({ controle, desabilitado }) => { controle.disabled = desabilitado; });
                locationButton.disabled = buscandoLocalizacao || !window.L;
                anexos?.atualizar();
            }
            submitButton.disabled = relatoEnviado;
            submitButton.textContent = relatoEnviado ? (edicao ? "Alterações salvas" : "Relato enviado")
                : edicao ? "Salvar alterações para revisão" : "Enviar relato para revisão";
        }
    });

    if (edicao) {
        titleInput.value = edicao.titulo;
        descriptionInput.value = edicao.descricao;
        document.getElementById("reference").value = edicao.referencia ?? "";
        for (const [nome, valor] of [["categoria", edicao.categoriaSlug], ["severidade", edicao.severidade]]) {
            form.querySelectorAll('input[name="' + nome + '"]').forEach(input => {
                input.checked = input.value.toLowerCase() === valor;
                input.closest("label").classList.toggle("is-selected", input.checked);
            });
        }
        dropdownFields.forEach(syncDropdownLabel);
        latitudeInput.value = String(edicao.latitude); longitudeInput.value = String(edicao.longitude);
        coordinates.textContent = edicao.latitude.toFixed(5) + ", " + edicao.longitude.toFixed(5);
        definirPontoInicial({ lat: edicao.latitude, lng: edicao.longitude });
        // Não dispara geocoding ao abrir: preserva o bairro original até mudar o ponto.
        autocompleteBairros.selecionar({ id: edicao.bairroId, nome: edicao.bairro, cidade: edicao.cidade });
    }
    updateCounter(titleInput, titleCount);
    updateCounter(descriptionInput, descriptionCount);
});
