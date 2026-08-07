document.addEventListener("DOMContentLoaded", () => {
    const titleInput = document.getElementById("report-title");
    const descriptionInput = document.getElementById("report-description");
    const titleCount = document.getElementById("title-count");
    const descriptionCount = document.getElementById("description-count");
    const categoryOptions = Array.from(document.querySelectorAll(".category-option"));
    const severityOptions = Array.from(document.querySelectorAll(".severity-options label"));
    const uploadZone = document.getElementById("upload-zone");
    const uploadInput = document.getElementById("photo-upload");
    const uploadFeedback = document.getElementById("upload-feedback");
    const miniMap = document.getElementById("mini-map");
    const mapPin = document.getElementById("map-pin");
    const coordinates = document.getElementById("coordinates");
    const form = document.getElementById("new-report-form");
    const formFeedback = document.getElementById("form-feedback");

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

    categoryOptions.forEach((option) => {
        option.addEventListener("click", () => selectOption(categoryOptions, option));
    });

    severityOptions.forEach((option) => {
        option.addEventListener("click", () => selectOption(severityOptions, option));
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

    uploadZone.addEventListener("drop", (event) => {
        const [file] = event.dataTransfer.files;
        if (file) {
            uploadFeedback.textContent = `Foto selecionada: ${file.name}`;
        }
    });

    uploadInput.addEventListener("change", () => {
        const [file] = uploadInput.files;
        uploadFeedback.textContent = file ? `Foto selecionada: ${file.name}` : "";
    });

    miniMap.addEventListener("click", (event) => {
        const rect = miniMap.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        const lat = (-23.5200 - y * 0.00078).toFixed(4);
        const lng = (-46.7300 + x * 0.00145).toFixed(4);

        mapPin.style.setProperty("--pin-x", `${x}%`);
        mapPin.style.setProperty("--pin-y", `${y}%`);
        coordinates.textContent = `${lat}, ${lng}`;
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        formFeedback.textContent = "Relato mockado enviado para revisao. Nenhum backend foi acionado.";
    });

    updateCounter(titleInput, titleCount);
    updateCounter(descriptionInput, descriptionCount);
});
