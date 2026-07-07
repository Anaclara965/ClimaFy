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
});