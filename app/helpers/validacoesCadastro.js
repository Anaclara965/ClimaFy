const { body } = require("express-validator");
const { senhaValida } = require("./senha");

// ---------------------------------------------------------------------------
// Regras de validacao do cadastro e do login.
// A regra de SENHA vive em app/helpers/senha.js e e a mesma usada para gerar o
// hash e o checklist do front -- era o ponto onde as duas pontas divergiam.
// ---------------------------------------------------------------------------

const MENSAGEM_SENHA =
  "A senha deve ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo.";

const validarNome = body("nome")
  .trim()
  .isLength({ min: 2, max: 120 })
  .withMessage("O nome deve ter entre 2 e 120 caracteres.");

const validarSobrenome = body("sobrenome")
  .trim()
  .isLength({ min: 2, max: 80 })
  .withMessage("O sobrenome deve ter entre 2 e 80 caracteres.");

const validarEmail = body("email")
  .trim()
  .toLowerCase()
  .isEmail()
  .withMessage("O email deve ser válido.")
  .isLength({ max: 190 })
  .withMessage("O email deve ter no máximo 190 caracteres.");

// Cidade saiu do formulario (secao 3 do README: a cidade e derivada do bairro).
// O que chega aqui e o ID do bairro escolhido no autocomplete /api/bairros.
const validarBairro = body("bairro")
  .trim()
  .notEmpty()
  .withMessage("Selecione o seu bairro.")
  .isInt({ min: 1 })
  .withMessage("Selecione um bairro da lista sugerida.");

const validarSenha = body("senha").custom((valor) => {
  if (!senhaValida(valor)) throw new Error(MENSAGEM_SENHA);
  return true;
});

const validarConfirmacaoSenha = body("confirma-senha").custom((valor, { req }) => {
  if (valor !== req.body.senha) throw new Error("As senhas não coincidem.");
  return true;
});

const validarTermos = body("termos")
  .equals("aceito")
  .withMessage("Você deve aceitar os termos de uso e a política de privacidade.");

// Login: mensagens curtas; a conferencia real e no controller.
const validarEmailLogin = body("email")
  .trim()
  .toLowerCase()
  .isEmail()
  .withMessage("Informe um e-mail válido.");

const validarSenhaLogin = body("senha")
  .notEmpty()
  .withMessage("Informe a sua senha.");

// Codigo OTP: 6 digitos, nada mais (o hash e comparado no servidor).
const validarCodigo = body("codigo")
  .trim()
  .matches(/^\d{6}$/)
  .withMessage("Informe os 6 dígitos do código.");

// Preferencias: o formulario manda ids de bairro e slugs de categoria.
const validarBairrosPreferencia = body("bairros")
  .optional()
  .custom((valor) => {
    const lista = Array.isArray(valor) ? valor : [valor];
    const ids = lista.filter((item) => item !== "" && item !== undefined && item !== null);
    if (ids.length > 20) throw new Error("Escolha no máximo 20 bairros.");
    const invalido = ids.find((item) => !/^\d+$/.test(String(item)));
    if (invalido) throw new Error("Bairro inválido na lista de preferências.");
    return true;
  });

const validarFrequencia = body("frequencia")
  .optional()
  .isIn(["imediato", "diario", "semanal"])
  .withMessage("Frequência inválida.");

module.exports = {
  MENSAGEM_SENHA,
  validarNome,
  validarSobrenome,
  validarEmail,
  validarBairro,
  validarSenha,
  validarConfirmacaoSenha,
  validarTermos,
  validarEmailLogin,
  validarSenhaLogin,
  validarCodigo,
  validarBairrosPreferencia,
  validarFrequencia,
};
