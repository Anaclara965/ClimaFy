const express = require("express")
const app = express()
const port = 3000
const dotenv = require("dotenv").config();

app.use(express.static('app/public', {
  setHeaders: (res, filePath) => {
    // Durante o desenvolvimento, CSS/JS nunca ficam presos no cache do navegador
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.set('view engine', 'ejs');
app.set('views', './app/views');

app.use(express.json())
app.use(express.urlencoded({extended:true}));

const rotaPrincipal = require("./app/routes/router")
app.use("/", rotaPrincipal)

const rotaADM = require("./app/routes/router-adm")
app.use("/", rotaADM)

app.listen(port, () => {
  console.log(`Servidor ouvindo na porta ${port}
    \nhttp://localhost:${port}`);
});