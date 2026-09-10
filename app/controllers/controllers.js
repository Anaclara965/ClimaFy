const {validationResult} = require("express-validator");

function mostrarCadastro(req, res) {
    res.render("pages/cadastro-dados-pessoais", {
        erros: [],
        valores: {nome: "", sobrenome: "", email: "", cidade: "", bairro: ""}
    })
}

function processarCadastro(req, res) {
    const { nome, sobrenome, email, cidade, bairro } = req.body;

    const erros = validationResult(req);
    if(!erros.isEmpty()){
        return res.status(422).render("pages/cadastro-dados-pessoais", {
            erros: erros.array().map((erro) => erro.msg),
            valores: { nome, sobrenome, email, cidade, bairro }
        })
    }
    res.status(200).json({
        recebido: true,
        nome,
        sobrenome,
        email,
        cidade,
        bairro
    });
}

module.exports = {
    mostrarCadastro,
    processarCadastro
};