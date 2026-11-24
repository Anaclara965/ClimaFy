(function () {
  "use strict";

  var STORAGE_KEY = "climafy-accessibility";
  var MIN_FONT_SCALE = 0.9;
  var MAX_FONT_SCALE = 1.2;
  var FONT_STEP = 0.1;
  var DEFAULT_PREFERENCES = {
    fontScale: 1,
    highContrast: false,
    highlightLinks: false,
    reduceMotion: false,
  };

  function readPreferences() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return { ...DEFAULT_PREFERENCES };

      var preferences = JSON.parse(stored);
      var fontScale = Number(preferences.fontScale);
      return {
        fontScale: Number.isFinite(fontScale)
          ? Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, fontScale))
          : DEFAULT_PREFERENCES.fontScale,
        highContrast: preferences.highContrast === true,
        highlightLinks: preferences.highlightLinks === true,
        reduceMotion: preferences.reduceMotion === true,
      };
    } catch (error) {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  function savePreferences(preferences) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      // A preferência continua válida durante a página atual quando o armazenamento está indisponível.
    }
  }

  function updateButtons(preferences) {
    var contrastButton = document.querySelector(
      '[data-accessibility-action="toggle-contrast"]'
    );
    var linksButton = document.querySelector(
      '[data-accessibility-action="toggle-links"]'
    );
    var motionButton = document.querySelector(
      '[data-accessibility-action="toggle-motion"]'
    );
    var decreaseButton = document.querySelector(
      '[data-accessibility-action="decrease-font"]'
    );
    var increaseButton = document.querySelector(
      '[data-accessibility-action="increase-font"]'
    );
    var resetButton = document.querySelector(
      '[data-accessibility-action="reset-font"]'
    );

    if (contrastButton) {
      contrastButton.setAttribute("aria-pressed", String(preferences.highContrast));
      contrastButton.setAttribute(
        "aria-label",
        preferences.highContrast
          ? "Desativar alto contraste"
          : "Ativar alto contraste"
      );
    }
    if (linksButton) {
      linksButton.setAttribute("aria-pressed", String(preferences.highlightLinks));
      linksButton.setAttribute(
        "aria-label",
        preferences.highlightLinks ? "Desativar destaque de links" : "Destacar links"
      );
    }
    if (motionButton) {
      motionButton.setAttribute("aria-pressed", String(preferences.reduceMotion));
      motionButton.setAttribute(
        "aria-label",
        preferences.reduceMotion
          ? "Restaurar animações"
          : "Reduzir animações"
      );
    }
    if (decreaseButton) decreaseButton.disabled = preferences.fontScale <= MIN_FONT_SCALE;
    if (increaseButton) increaseButton.disabled = preferences.fontScale >= MAX_FONT_SCALE;
    if (resetButton) {
      var isDefault =
        preferences.fontScale === DEFAULT_PREFERENCES.fontScale &&
        !preferences.highContrast &&
        !preferences.highlightLinks &&
        !preferences.reduceMotion;
      resetButton.disabled = isDefault;
    }
  }

  function applyPreferences(preferences) {
    document.documentElement.style.setProperty(
      "--accessibility-font-scale",
      String(preferences.fontScale)
    );
    document.documentElement.classList.toggle(
      "accessibility-high-contrast",
      preferences.highContrast
    );
    document.documentElement.classList.toggle(
      "accessibility-highlight-links",
      preferences.highlightLinks
    );
    document.documentElement.classList.toggle(
      "accessibility-reduce-motion",
      preferences.reduceMotion
    );
    updateButtons(preferences);
  }

  function updatePreferences(change) {
    var preferences = readPreferences();
    if (change === "increase-font") preferences.fontScale += FONT_STEP;
    if (change === "decrease-font") preferences.fontScale -= FONT_STEP;
    if (change === "reset-font") preferences.fontScale = DEFAULT_PREFERENCES.fontScale;
    if (change === "toggle-contrast") preferences.highContrast = !preferences.highContrast;
    if (change === "toggle-links") preferences.highlightLinks = !preferences.highlightLinks;
    if (change === "toggle-motion") preferences.reduceMotion = !preferences.reduceMotion;
    if (change === "reset-font") {
      preferences = { ...DEFAULT_PREFERENCES };
    }

    preferences.fontScale = Math.min(
      MAX_FONT_SCALE,
      Math.max(MIN_FONT_SCALE, Number(preferences.fontScale.toFixed(2)))
    );
    savePreferences(preferences);
    applyPreferences(preferences);
  }

  var preferences = readPreferences();
  applyPreferences(preferences);

  document.querySelectorAll("[data-accessibility-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      updatePreferences(button.getAttribute("data-accessibility-action"));
    });
  });

  var trigger = document.querySelector(".accessibility-trigger");
  var panel = document.getElementById("accessibility-panel");
  if (!trigger || !panel) return;

  var closeTimer = null;

  function closePanel(returnFocus) {
    if (panel.hidden) return;
    if (closeTimer) window.clearTimeout(closeTimer);
    panel.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Abrir painel de acessibilidade");
    var controls = trigger.closest(".accessibility-controls");
    if (controls) controls.classList.remove("opens-up");

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("accessibility-reduce-motion");
    closeTimer = window.setTimeout(function () {
      panel.hidden = true;
      closeTimer = null;
    }, reduceMotion ? 0 : 180);

    if (returnFocus) trigger.focus();
  }

  function openPanel() {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    panel.hidden = false;
    window.requestAnimationFrame(function () {
      panel.classList.add("is-open");
      var panelHeight = panel.offsetHeight;
      var triggerRect = trigger.getBoundingClientRect();
      var controls = trigger.closest(".accessibility-controls");
      var bottomNavReserve = window.matchMedia("(max-width: 767.98px)").matches &&
        document.querySelector(".bottom-nav") ? 112 : 12;
      var canOpenBelow =
        triggerRect.bottom + 8 + panelHeight <= window.innerHeight - bottomNavReserve;
      if (controls) controls.classList.toggle("opens-up", !canOpenBelow);
    });
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-label", "Fechar painel de acessibilidade");
  }

  trigger.addEventListener("click", function (event) {
    event.stopPropagation();
    if (trigger.getAttribute("aria-expanded") === "true") {
      closePanel(false);
    } else {
      openPanel();
    }
  });

  document.addEventListener("click", function (event) {
    if (
      window.matchMedia("(max-width: 767.98px)").matches &&
      trigger.getAttribute("aria-expanded") === "true" &&
      !panel.contains(event.target) &&
      !trigger.contains(event.target)
    ) {
      closePanel(true);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape" &&
      window.matchMedia("(max-width: 767.98px)").matches &&
      trigger.getAttribute("aria-expanded") === "true"
    ) {
      closePanel(true);
    }
  });
})();
