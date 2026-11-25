const { body } = require("express-validator");
const { senhaValida, senhaExcedeLimiteBytes, MENSAGEM_SENHA_LONGA } = require("./senha");
const { MENSAGEM_SENHA } = require("./validacoesCadastro");

const validarEmailRecuperacao = body("email")
  .isString().withMessage("Informe um e-mail válido.").bail()
  .trim().toLowerCase().isLength({ max: 190 }).withMessage("O e-mail deve ter no máximo 190 caracteres.")
  .bail().isEmail().withMessage("Informe um e-mail válido.");
const validarCodigoRecuperacao = body("codigo")
  .isString().withMessage("Informe os 6 dígitos do código.").bail()
  .trim().matches(/^\d{6}$/).withMessage("Informe os 6 dígitos do código.");
const validarNovaSenha = body("senha").custom(valor => {
  if (typeof valor !== "string" || !senhaValida(valor)) throw new Error(MENSAGEM_SENHA);
  if (senhaExcedeLimiteBytes(valor)) throw new Error(MENSAGEM_SENHA_LONGA);
  return true;
});
const validarConfirmacaoNovaSenha = body("confirma-senha").custom((valor, { req }) => {
  if (typeof valor !== "string" || valor !== req.body.senha) throw new Error("As senhas não coincidem.");
  return true;
});

module.exports = { validarEmailRecuperacao, validarCodigoRecuperacao, validarNovaSenha, validarConfirmacaoNovaSenha };
