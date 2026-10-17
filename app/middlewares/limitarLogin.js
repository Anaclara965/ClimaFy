const { createHmac, randomBytes } = require("node:crypto");

// Defesa local: os contadores não são compartilhados entre processos/instâncias.
// Conta TODOS os pedidos, antes da validação, consulta ao banco e bcrypt.
function criarLimiteLogin({
  limitePorIp = 50,
  limitePorConta = 20,
  janelaMs = 15 * 60 * 1000,
  maxChaves = 10000,
  agora = Date.now,
} = {}) {
  for (const valor of [limitePorIp, limitePorConta, janelaMs, maxChaves]) {
    if (!Number.isSafeInteger(valor) || valor < 1) {
      throw new TypeError("Os limites do login devem ser inteiros positivos.");
    }
  }
  if (typeof agora !== "function") throw new TypeError("Relógio inválido.");

  const contadores = new Map();
  // Não armazena e-mail, IP, cookie ou senha em claro; chave efêmera por instância.
  const segredo = randomBytes(32);
  const chave = (tipo, valor) => createHmac("sha256", segredo)
    .update(tipo).update("\0").update(valor).digest("hex");

  function consumir(identificador, limite, tempo) {
    let entrada = contadores.get(identificador);
    if (!entrada) {
      // Não expulsa limites ativos: variar e-mails não deve liberar um atacante.
      if (contadores.size >= maxChaves) return tempo + janelaMs;
      entrada = { total: 0, ate: tempo + janelaMs };
      contadores.set(identificador, entrada);
    }
    if (entrada.total >= limite) return entrada.ate;
    entrada.total++;
    return null;
  }

  return function limitarLogin(req, res, next) {
    res.set("Cache-Control", "no-store");
    const tempo = agora();
    for (const [identificador, entrada] of contadores) {
      if (entrada.ate <= tempo) contadores.delete(identificador);
    }

    // req.ip respeita a configuração do Express; nunca ler X-Forwarded-For aqui.
    const ip = typeof req.ip === "string" ? req.ip : "ip-indisponivel";
    let bloqueadoAte = consumir(chave("ip", ip), limitePorIp, tempo);
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!bloqueadoAte && email && email.length <= 190) {
      // Global por e-mail, não por combinação IP/e-mail: trocar IP não zera a conta.
      bloqueadoAte = consumir(chave("conta", email), limitePorConta, tempo);
    }
    if (bloqueadoAte) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((bloqueadoAte - tempo) / 1000))));
      return res.status(429).render("pages/erro", {
        status: 429,
        titulo: "Aguarde para tentar novamente",
        mensagem: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente. Se esqueceu a senha, use a recuperação de senha.",
      });
    }
    return next();
  };
}

module.exports = { criarLimiteLogin };
