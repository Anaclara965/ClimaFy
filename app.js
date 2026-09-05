const path = require("node:path");
const express = require("express");

app.use(express.static('app/public', {
  setHeaders: (res, filePath) => {
    // Durante o desenvolvimento, CSS/JS nunca ficam presos no cache do navegador
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "app", "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "app", "views"));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", application: "ClimaFy" });
});

const rotaPrincipal = require("./app/routes/router");
const rotaADM = require("./app/routes/router-adm");

app.use("/", rotaPrincipal);
app.use("/", rotaADM);

app.use((req, res) => {
  res.status(404).json({ error: "Rota nao encontrada" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno do servidor" });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor ouvindo na porta ${port}`);
    console.log(`http://localhost:${port}`);
  });
}

module.exports = app;
