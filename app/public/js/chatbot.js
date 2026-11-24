(function () {
  "use strict";

  var STORAGE_KEY = "climafy-chatbot-session";
  var trigger = document.querySelector(".chatbot-trigger");
  var windowElement = document.querySelector(".chatbot-window");
  var closeButton = document.querySelector(".chatbot-close");
  var messagesElement = document.querySelector(".chatbot-messages");
  var mascotSource = "/images/chatbot-mascot.svg";
  var form = document.querySelector(".chatbot-form");
  var input = document.querySelector("#chatbot-input");
  var sendButton = document.querySelector(".chatbot-send");
  var suggestionButtons = document.querySelectorAll("[data-chatbot-suggestion]");
  var closeTimer = null;

  if (!trigger || !windowElement || !closeButton || !messagesElement || !form || !input) return;

  function updateMobileLayout() {
    if (!window.matchMedia("(max-width: 767.98px)").matches) return;
    var header = document.querySelector(".main-header");
    var headerBottom = header ? Math.ceil(header.getBoundingClientRect().bottom) : 76;
    var viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--chatbot-header-bottom", headerBottom + "px");
    document.documentElement.style.setProperty("--chatbot-viewport-height", viewportHeight + "px");
  }

  function readMessages() {
    try {
      var messages = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      return Array.isArray(messages) ? messages.slice(-30) : [];
    } catch (error) {
      return [];
    }
  }

  var messages = readMessages();

  function saveMessages() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch (error) {
      // A conversa continua disponível nesta página se o armazenamento estiver indisponível.
    }
  }

  function addMessage(role, text) {
    var element = document.createElement("div");
    element.className = "chatbot-message " + role;
    if (role === "assistant") {
      var avatar = document.createElement("img");
      avatar.className = "chatbot-avatar";
      avatar.src = mascotSource;
      avatar.alt = "";
      avatar.setAttribute("aria-hidden", "true");
      element.appendChild(avatar);
    }
    var content = document.createElement("span");
    content.textContent = text;
    element.appendChild(content);
    messagesElement.appendChild(element);
    messagesElement.scrollTop = messagesElement.scrollHeight;
    return element;
  }

  function renderMessages() {
    messagesElement.replaceChildren();
    if (!messages.length) {
      var initial = "Olá! Sou o assistente do ClimaFy. Posso ajudar com informações sobre a plataforma, ocorrências, relatos públicos e ranking.";
      addMessage("assistant", initial);
      messages.push({ role: "assistant", text: initial });
      saveMessages();
      return;
    }
    messages.forEach(function (message) {
      addMessage(message.role, message.text);
    });
  }

  function openChat() {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    windowElement.hidden = false;
    trigger.classList.add("is-open");
    window.requestAnimationFrame(function () {
      windowElement.classList.add("is-open");
    });
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-label", "Fechar assistente virtual");
    window.setTimeout(function () {
      input.focus();
    }, 200);
  }

  function closeChat(returnFocus) {
    if (windowElement.hidden) return;
    windowElement.classList.remove("is-open");
    trigger.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Abrir assistente virtual");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("accessibility-reduce-motion");
    closeTimer = window.setTimeout(function () {
      windowElement.hidden = true;
      closeTimer = null;
    }, reduceMotion ? 0 : 180);
    if (returnFocus) trigger.focus();
  }

  async function sendMessage(text) {
    var mensagem = text.trim();
    if (!mensagem) return;

    addMessage("user", mensagem);
    messages.push({ role: "user", text: mensagem });
    saveMessages();
    input.value = "";
    sendButton.disabled = true;
    input.disabled = true;

    var processing = addMessage("processing", "Preparando uma resposta...");
    try {
      var response = await fetch("/api/chatbot/mensagem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ mensagem: mensagem }),
      });
      var data = await response.json().catch(function () { return null; });
      processing.remove();
      if (!response.ok) {
        throw new Error(data && data.erro ? data.erro : "Não foi possível preparar uma resposta.");
      }
      var resposta = data && data.resposta ? data.resposta : "Não consegui responder agora.";
      addMessage("assistant", resposta);
      messages.push({ role: "assistant", text: resposta });
      saveMessages();
    } catch (error) {
      processing.remove();
      var friendly = "Desculpe, ocorreu um problema ao preparar a resposta. Tente novamente.";
      addMessage("assistant", friendly);
      messages.push({ role: "assistant", text: friendly });
      saveMessages();
    } finally {
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  trigger.addEventListener("click", function (event) {
    event.stopPropagation();
    if (trigger.getAttribute("aria-expanded") === "true") {
      closeChat(false);
    } else {
      openChat();
    }
  });

  closeButton.addEventListener("click", function () {
    closeChat(true);
  });

  document.addEventListener("click", function (event) {
    if (
      trigger.getAttribute("aria-expanded") === "true" &&
      !windowElement.contains(event.target) &&
      !trigger.contains(event.target)
    ) {
      closeChat(true);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && trigger.getAttribute("aria-expanded") === "true") {
      closeChat(true);
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage(input.value);
  });

  suggestionButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      sendMessage(button.getAttribute("data-chatbot-suggestion"));
    });
  });

  renderMessages();
  updateMobileLayout();
  window.addEventListener("resize", updateMobileLayout);
  window.addEventListener("orientationchange", updateMobileLayout);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", updateMobileLayout);
})();
