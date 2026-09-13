const {validationResult} = require("express-validator");

// COMENTÁRIO PRO CARINHA DO BACK: este controller apenas valida e devolve JSON.
// Para o fluxo de cadastro multi-step (dados -> verificação -> preferências -> welcome),
// o backend precisa: criar usuário com senha hash, gerar código de verificação com expiração,
// e redirecionar para /cadastro-verificacao. Validação de senha deve refletir o front (complexidade).
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