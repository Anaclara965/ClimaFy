(function () {
  "use strict";

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/css/climafy-widgets.css";
  document.head.append(stylesheet);

  const root = document.querySelector("[data-climafy-widgets]");
  if (!root) return;

  const storageKey = "climafy-preferencias-acessibilidade-v1";
  const positionKey = "climafy-posicao-acessibilidade-v1";
  const trigger = root.querySelector(".climafy-a11y-trigger");
  const a11yPanel = root.querySelector(".climafy-a11y-panel");
  const a11yClose = a11yPanel.querySelector(".climafy-widget-close");
  const chatTrigger = root.querySelector(".climafy-chat-trigger");
  const chatPanel = root.querySelector(".climafy-chat-panel");
  const chatClose = chatPanel.querySelector(".climafy-widget-close");
  const chatForm = root.querySelector(".climafy-chat-form");
  const chatInput = root.querySelector("#climafy-chat-input");
  const chatMessages = root.querySelector(".climafy-chat-messages");
  const chatLoading = root.querySelector(".climafy-chat-loading");
  const chatSend = chatForm.querySelector('button[type="submit"]');
  const fontSteps = [90, 100, 110, 120, 125];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let settings = { fontScale: 100, contrast: false, underline: false, motion: false };
  let dragged = false;
  let dragState = null;

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      return false;
    }
    return true;
  }

  function loadSettings() {
    const stored = readStorage(storageKey);
    if (!stored) return;
    try {
      const saved = JSON.parse(stored);
      if (fontSteps.includes(saved.fontScale)) settings.fontScale = saved.fontScale;
      ["contrast", "underline", "motion"].forEach((key) => {
        if (typeof saved[key] === "boolean") settings[key] = saved[key];
      });
    } catch (error) {
      settings = { fontScale: 100, contrast: false, underline: false, motion: false };
    }
  }

  function saveSettings() {
    writeStorage(storageKey, JSON.stringify(settings));
  }

  function applySettings() {
    const html = document.documentElement;
    html.dataset.a11yFontScale = String(settings.fontScale);
    html.dataset.a11yContrast = settings.contrast ? "high" : "default";
    html.dataset.a11yUnderline = String(settings.underline);
    html.dataset.a11yStopMotion = String(settings.motion);
    root.querySelectorAll("[data-setting]").forEach((button) => {
      const active = button.dataset.setting === "motion"
        ? settings.motion || reducedMotion.matches
        : settings[button.dataset.setting];
      button.setAttribute("aria-pressed", String(active));
    });
    const contrastLabel = root.querySelector("[data-contrast-label]");
    contrastLabel.textContent = settings.contrast ? "Alto contraste" : "Contraste padrão";
  }

  function loadPosition() {
    const stored = readStorage(positionKey);
    if (!stored) return null;
    try {
      const position = JSON.parse(stored);
      if (Number.isFinite(position.left) && Number.isFinite(position.top)) return position;
    } catch (error) {
      return null;
    }
    return null;
  }

  function clampPosition(left, top) {
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    return {
      left: Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin)),
    };
  }

  function setTriggerPosition(left, top, persist) {
    const position = clampPosition(left, top);
    trigger.style.left = position.left + "px";
    trigger.style.top = position.top + "px";
    trigger.style.right = "auto";
    trigger.style.bottom = "auto";
    if (persist) writeStorage(positionKey, JSON.stringify(position));
    positionPanels();
  }

  function positionPanels() {
    if (a11yPanel.hidden) return;
    const rect = trigger.getBoundingClientRect();
    const width = a11yPanel.offsetWidth;
    const height = a11yPanel.offsetHeight;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - 12
      ? below
      : Math.max(12, rect.top - height - 8);
    a11yPanel.style.left = left + "px";
    a11yPanel.style.top = top + "px";
  }

  function setA11yPanel(open, returnFocus) {
    a11yPanel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      positionPanels();
      a11yPanel.querySelector("[data-font-step]").focus();
    }
    if (!open && returnFocus) trigger.focus();
  }

  function setChatPanel(open, returnFocus) {
    chatPanel.hidden = !open;
    chatTrigger.setAttribute("aria-expanded", String(open));
    if (open) chatInput.focus();
    else if (returnFocus) chatTrigger.focus();
  }

  function addMessage(text, sender) {
    const message = document.createElement("p");
    message.className = "climafy-chat-message climafy-chat-" + sender;
    message.textContent = text;
    chatMessages.append(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function submitQuestion(event) {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question || chatSend.disabled) return;

    addMessage(question, "user");
    chatInput.value = "";
    chatSend.disabled = true;
    chatLoading.hidden = false;
    chatMessages.setAttribute("aria-busy", "true");

    window.setTimeout(() => {
      const isAdmin = root.dataset.admin === "true";
      const answer = window.ClimaFyChatbotRespostas.responder(question, isAdmin);
      addMessage(answer, "bot");
      chatLoading.hidden = true;
      chatMessages.setAttribute("aria-busy", "false");
      chatSend.disabled = false;
      chatInput.focus();
    }, 250);
  }

  loadSettings();
  applySettings();

  const savedPosition = loadPosition();
  if (savedPosition) {
    window.requestAnimationFrame(() => setTriggerPosition(savedPosition.left, savedPosition.top, false));
  }

  root.querySelectorAll("[data-font-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const currentIndex = fontSteps.indexOf(settings.fontScale);
      const nextIndex = Math.max(0, Math.min(fontSteps.length - 1, currentIndex + Number(button.dataset.fontStep)));
      settings.fontScale = fontSteps[nextIndex];
      applySettings();
      saveSettings();
    });
  });

  root.querySelectorAll("[data-setting]").forEach((button) => {
    button.addEventListener("click", () => {
      const setting = button.dataset.setting;
      settings[setting] = !settings[setting];
      applySettings();
      saveSettings();
    });
  });

  root.querySelector("[data-reset-settings]").addEventListener("click", () => {
    settings = { fontScale: 100, contrast: false, underline: false, motion: false };
    applySettings();
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      saveSettings();
    }
  });

  trigger.addEventListener("click", () => {
    if (dragged) {
      dragged = false;
      return;
    }
    setA11yPanel(a11yPanel.hidden, false);
  });

  trigger.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = trigger.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    trigger.setPointerCapture(event.pointerId);
  });

  trigger.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) < 6) return;
    dragState.moved = true;
    dragged = true;
    event.preventDefault();
    setTriggerPosition(dragState.left + dx, dragState.top + dy, false);
  });

  function finishDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (dragState.moved) {
      const rect = trigger.getBoundingClientRect();
      writeStorage(positionKey, JSON.stringify({ left: rect.left, top: rect.top }));
      window.setTimeout(() => { dragged = false; }, 0);
    }
    if (trigger.hasPointerCapture(event.pointerId)) trigger.releasePointerCapture(event.pointerId);
    dragState = null;
  }

  trigger.addEventListener("pointerup", finishDrag);
  trigger.addEventListener("pointercancel", finishDrag);

  a11yClose.addEventListener("click", () => setA11yPanel(false, true));
  chatTrigger.addEventListener("click", () => setChatPanel(chatPanel.hidden, false));
  chatClose.addEventListener("click", () => setChatPanel(false, true));
  chatForm.addEventListener("submit", submitQuestion);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!chatPanel.hidden) setChatPanel(false, true);
    else if (!a11yPanel.hidden) setA11yPanel(false, true);
  });

  window.addEventListener("resize", () => {
    const rect = trigger.getBoundingClientRect();
    setTriggerPosition(rect.left, rect.top, true);
    positionPanels();
  });

  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", applySettings);
  } else if (typeof reducedMotion.addListener === "function") {
    reducedMotion.addListener(applySettings);
  }
})();
