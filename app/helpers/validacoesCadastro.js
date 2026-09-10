const { body } = require("express-validator");

const validarNome = body("nome")
.trim()
.isLength({ min: 2 })
.withMessage("O nome deve ter pelo menos 2 caracteres.")

const validarSobrenome = body("sobrenome")
.trim()
.isLength({ min: 2 })
.withMessage("O sobrenome deve ter pelo menos 2 caracteres.");

const validarEmail = body("email")
.trim()
.isEmail()
.withMessage("O email deve ser válido.");

const validarCidade = body("cidade")
.trim()
.notEmpty()
.withMessage("Informe a cidade.");

const validarBairro = body("bairro")
.trim()
.notEmpty()
.withMessage("Informe o bairro.");

const validarSenha = body("senha")
.isLength({ min: 8 })
.withMessage("A senha deve ter pelo menos 8 caracteres.");

const validarConfirmacaoSenha = body("confirma-senha")
.custom((value, { req }) => {
    if (value !== req.body.senha) {
        throw new Error("As senhas não coincidem.");
    }

    return true;
});

const validarTermos = body("termos")
.equals("aceito")
.withMessage("Você deve aceitar os termos de uso e a política de privacidade.");

module.exports = { 
    validarNome,
    validarSobrenome,
    validarEmail,
    validarCidade,
    validarBairro,
    validarSenha,
    validarConfirmacaoSenha,
    validarTermos
};