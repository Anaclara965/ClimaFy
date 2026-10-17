const { randomBytes, timingSafeEqual } = require("node:crypto");

function tokenRecuperacao(req) {
  req.session.csrfRecuperacao ??= randomBytes(32).toString("hex");
  return req.session.csrfRecuperacao;
}

function exigirCsrfRecuperacao(req, res, next) {
  res.set("Cache-Control", "no-store");
  const recebido = req.body?._csrf;
  const esperado = req.session?.csrfRecuperacao;
  if (typeof recebido !== "string" || !/^[a-f0-9]{64}$/.test(recebido) ||
      typeof esperado !== "string" || !/^[a-f0-9]{64}$/.test(esperado) ||
      !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) {
    return res.status(403).render("pages/erro", {
      status: 403, titulo: "Formulário expirado",
      mensagem: "Abra novamente Esqueceu sua senha? na tela de login e tente outra vez.",
    });
  }
  next();
}

// Proteção local por IP. Em múltiplas instâncias, substituir por armazenamento compartilhado.
function criarLimiteRecuperacao({ limite = 10, janelaMs = 15 * 60 * 1000, agora = Date.now } = {}) {
  const pedidos = new Map();
  return function limitar(req, res, next) {
    const tempo = agora();
    for (const [ip, entrada] of pedidos) if (entrada.ate <= tempo) pedidos.delete(ip);
    const chave = req.ip;
    let entrada = pedidos.get(chave);
    if (!entrada && pedidos.size < 5000) {
      entrada = { total: 0, ate: tempo + janelaMs };
      pedidos.set(chave, entrada);
    }
    if (!entrada || entrada.total >= limite) {
      res.set("Retry-After", String(Math.ceil(((entrada?.ate ?? tempo + janelaMs) - tempo) / 1000)));
      return res.status(429).render("pages/erro", {
        status: 429, titulo: "Aguarde para tentar novamente",
        mensagem: "Muitas tentativas de recuperação. Aguarde alguns minutos antes de repetir.",
      });
    }
    entrada.total++;
    next();
  };
}

module.exports = { tokenRecuperacao, exigirCsrfRecuperacao, criarLimiteRecuperacao };
