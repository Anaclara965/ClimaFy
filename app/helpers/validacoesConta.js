const { body } = require("express-validator");
const { senhaValida } = require("./senha");
const { MENSAGEM_SENHA } = require("./validacoesCadastro");

const validarNomePerfil = body("nome")
  .isString().withMessage("Informe um nome válido.").bail()
  .trim().isLength({ min: 2, max: 120 })
  .withMessage("O nome deve ter entre 2 e 120 caracteres.");

const validarSobrenomePerfil = body("sobrenome")
  .isString().withMessage("Informe um sobrenome válido.").bail()
  .trim().isLength({ min: 2, max: 80 })
  .withMessage("O sobrenome deve ter entre 2 e 80 caracteres.");

const validarTelefone = body("telefone")
  .isString().withMessage("Informe um telefone válido.").bail()
  .trim().custom(valor => {
    if (!valor) return true;
    if (!/^\+?[0-9().\s-]{7,24}$/.test(valor) || valor.replace(/\D/g, "").length < 8 ||
        valor.replace(/\D/g, "").length > 15) {
      throw new Error("Informe um telefone com DDD e até 15 dígitos.");
    }
    return true;
  });

const validarEmailNovo = body("emailNovo")
  .isString().withMessage("Informe um e-mail válido.").bail()
  .trim().toLowerCase().isLength({ max: 190 })
  .withMessage("O e-mail deve ter no máximo 190 caracteres.")
  .bail().isEmail().withMessage("Informe um e-mail válido.");

const validarCodigoEmail = body("codigoEmail")
  .isString().withMessage("Informe os 6 dígitos do código.").bail()
  .trim().matches(/^\d{6}$/).withMessage("Informe os 6 dígitos do código.");

const validarSenhaAtual = body("senhaAtual")
  .isString().withMessage("Informe sua senha atual.").bail()
  .notEmpty().withMessage("Informe sua senha atual.");

const validarNovaSenha = body("novaSenha").custom(valor => {
  if (typeof valor !== "string" || !senhaValida(valor)) throw new Error(MENSAGEM_SENHA);
  if (Buffer.byteLength(valor, "utf8") > 72) {
    throw new Error("A nova senha é longa demais. Reduza o tamanho e tente novamente.");
  }
  return true;
});

const validarConfirmacaoNovaSenha = body("confirmaNovaSenha").custom((valor, { req }) => {
  if (typeof valor !== "string" || valor !== req.body.novaSenha) {
    throw new Error("As senhas não coincidem.");
  }
  return true;
});

module.exports = {
  validarNomePerfil,
  validarSobrenomePerfil,
  validarTelefone,
  validarEmailNovo,
  validarCodigoEmail,
  validarSenhaAtual,
  validarNovaSenha,
  validarConfirmacaoNovaSenha,
};
