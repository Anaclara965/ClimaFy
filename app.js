const express = require("express")
const app = express()
const port = 3000
const dotenv = require("dotenv").config();

app.use(express.static('app/public'));

app.set('view engine', 'ejs');
app.set('views', './app/views');

app.use(express.json())
app.use(express.urlencoded({extended:true}));

const rotaPrincipal = require("./app/routes/router")
app.use("/", rotaPrincipal)

const rotaADM = require("./app/routes/router-adm")
app.use("/adm", rotaADM)

app.listen(port, () => {
  console.log(`Servidor ouvindo na porta ${port}
    \nhttp://localhost:${port}`);
});