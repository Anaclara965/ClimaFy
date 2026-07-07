document.addEventListener("DOMContentLoaded", () => {
    const neighborhoods = ["Brás", "Pinheiros", "Vila Madalena", "Jardim Helena", "Itaquera", "Mooca", "Santo Amaro", "Capão Redondo"];
    const input = document.getElementById("neighborhood-input");
    const results = document.getElementById("neighborhood-results");
    const selectedList = document.getElementById("selected-neighborhoods");
    const form = document.getElementById("preferences-form");
    const feedback = document.getElementById("preferences-feedback");
    const frequencyOptions = Array.from(document.querySelectorAll(".frequency-option"));
    const selectedNeighborhoods = new Set(["Jardim Helena"]);

    function renderSelectedNeighborhoods() {
        selectedList.innerHTML = "";

        selectedNeighborhoods.forEach((neighborhood) => {
            const chip = document.createElement("li");
            chip.className = "neighborhood-chip";
            chip.textContent = neighborhood;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.setAttribute("aria-label", `Remover ${neighborhood}`);
            removeButton.textContent = "×";
            removeButton.addEventListener("click", () => {
                selectedNeighborhoods.delete(neighborhood);
                renderSelectedNeighborhoods();
                renderResults(input.value);
            });

            chip.appendChild(removeButton);
            selectedList.appendChild(chip);
        });
    }

    function hideResults() {
        results.hidden = true;
        input.setAttribute("aria-expanded", "false");
    }

    function renderResults(query) {
        const normalizedQuery = query.trim().toLowerCase();
        results.innerHTML = "";

        if (!normalizedQuery) {
            hideResults();
            return;
        }

        const filteredNeighborhoods = neighborhoods.filter((neighborhood) => {
            return neighborhood.toLowerCase().includes(normalizedQuery) && !selectedNeighborhoods.has(neighborhood);
        });

        if (!filteredNeighborhoods.length) {
            const item = document.createElement("li");
            item.className = "empty-result";
            item.textContent = "Nenhum bairro encontrado";
            results.appendChild(item);
        }

        filteredNeighborhoods.forEach((neighborhood) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.setAttribute("role", "option");
            button.textContent = neighborhood;
            button.addEventListener("click", () => {
                selectedNeighborhoods.add(neighborhood);
                input.value = "";
                renderSelectedNeighborhoods();
                hideResults();
            });

            item.appendChild(button);
            results.appendChild(item);
        });

        results.hidden = false;
        input.setAttribute("aria-expanded", "true");
    }

    input.addEventListener("input", () => {
        renderResults(input.value);
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".neighborhood-search")) {
            hideResults();
        }
    });

    frequencyOptions.forEach((option) => {
        const radio = option.querySelector("input");

        option.addEventListener("click", () => {
            frequencyOptions.forEach((item) => item.classList.remove("is-selected"));
            option.classList.add("is-selected");
            radio.checked = true;
        });
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        feedback.textContent = "Preferências salvas com sucesso.";
    });

    renderSelectedNeighborhoods();
});