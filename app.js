const path = require("node:path");
const express = require("express");
const session = require("express-session");
const { tratarErroJson } = require("./app/middlewares/tratarErroJson");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT);

app.disable("x-powered-by");

// Em produção (Render) a aplicação fica atrás de proxy: sem isto o cookie
// "secure" e o req.ip não funcionam corretamente.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.static(path.join(__dirname, "app", "public")));

// CSVs oficiais (Defesa Civil + orçamento) consumidos por
// app/public/js/dados-publicos.js com fetch('/DADOS/...').
// Sem este mount a home e o ranking ficavam sem dados (404).
app.use("/DADOS", express.static(path.join(__dirname, "DADOS"), { index: false }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Sessão (README seção 5.1: sessão + cookie HttpOnly, não JWT)
// ---------------------------------------------------------------------------
if (!process.env.SESSION_SECRET) {
  console.warn(
    "[aviso] SESSION_SECRET não definido. Copie .env.example para .env antes de publicar."
  );
}

app.use(
  session({
    name: "climafy.sid",
    secret: process.env.SESSION_SECRET || "climafy-desenvolvimento",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // o JavaScript da página não lê o cookie
      sameSite: "lax", // mitiga CSRF em navegação normal
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  })
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "app", "views"));

// O header mostra "Entrar" ou o nome do usuário em todas as páginas.
app.use((req, res, next) => {
  res.locals.usuario = req.session?.usuario ?? null;
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", application: "ClimaFy" });
});

const rotaPrincipal = require("./app/routes/router");
const rotaADM = require("./app/routes/router-adm");

app.use("/", rotaPrincipal);
app.use("/", rotaADM);

// Contrato único de erro (README 6.1): API responde { erro }, página renderiza HTML.
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ erro: "Rota não encontrada" });
  }
  return res.status(404).render("pages/erro", {
    status: 404,
    titulo: "Página não encontrada",
    mensagem: "O endereço acessado não existe ou foi movido.",
  });
});

app.use(tratarErroJson);

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);

  if (req.originalUrl.startsWith("/api/")) {
    return res.status(500).json({ erro: "Erro interno do servidor" });
  }
  return res.status(500).render("pages/erro", {
    status: 500,
    titulo: "Erro interno",
    mensagem: "Algo falhou no servidor. Tente novamente em instantes.",
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor ouvindo na porta ${port}`);
    console.log(`http://localhost:${port}`);
  });
}

module.exports = app;

