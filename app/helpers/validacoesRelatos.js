const { body } = require("express-validator");

const validarTitulo = body("titulo")
    .trim()
    .notEmpty()
    .withMessage("O título é obrigatório.")
    .bail()
    .isLength({ max: 80 })
    .withMessage("O título deve ter no máximo 80 caracteres.");

const validarDescricao = body("descricao")
    .trim()
    .notEmpty()
    .withMessage("A descrição é obrigatória.")
    .bail()
    .isLength({ max: 280 })
    .withMessage("A descrição deve ter no máximo 280 caracteres.");

const validarSeveridade = body("severidade")
    .trim()
    .notEmpty()
    .withMessage("A severidade é obrigatória.")
    .bail()
    .toLowerCase()
    .isIn(["leve", "moderada", "grave", "critica"])
    .withMessage("Selecione uma severidade válida.");

const validarReferencia = body("referencia")
    .trim()
    .optional()
    .isLength({ max: 255 })
    .withMessage("A referência deve ter no máximo 255 caracteres.");

const validarBairroRelato = body("bairro")
    .trim()
    .notEmpty()
    .withMessage("Selecione o bairro do relato.")
    .bail()
    .isInt({ min: 1 })
    .withMessage("Selecione um bairro válido.");

const validarCategoria = body("categoria")
    .trim()
    .notEmpty()
    .withMessage("A categoria é obrigatória.")
    .bail()
    .toLowerCase()
    .isIn(["alagamento","queimada", "calor-extremo", "arvore-caida", "lixo", "poluicao-agua"])
    .withMessage("Selecione uma categoria válida.");

    const validarLatitude = body("latitude")
    .trim()
    .notEmpty()
    .withMessage("Informe a latitude do relato.")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("A latitude deve estar entre -90 e 90.")
    .bail()
    .toFloat();

const validarLongitude = body("longitude")
    .trim()
    .notEmpty()
    .withMessage("Informe a longitude do relato.")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("A longitude deve estar entre -180 e 180.")
    .bail()
    .toFloat();

module.exports = {
    validarTitulo,
    validarDescricao,
    validarSeveridade,
    validarReferencia,
    validarBairroRelato,
    validarCategoria,
    validarLatitude,
    validarLongitude
};