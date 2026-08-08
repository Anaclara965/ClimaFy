var express = require('express');
var router = express.Router(); 
const {body, validationResult} = require("express-validator")
// const {validarTelefone, validarDoacao} = require("../helpers/validacoes");
const { render, name } = require('ejs');

router.get("/", function (req, res) {
    res.render("pages/index")
});


router.get("/welcome", function (req, res) {
    res.render("pages/welcome")
});

router.get("/sobre", function (req, res) {
    res.render("pages/sobre")
});

router.get("/relatos", function (req, res) {
    res.render("pages/relatos")
});

router.get("/ranking", function (req, res) {
    res.render("pages/ranking")
});

router.get("/new-report", function (req, res) {
    res.render("pages/new-report")
});

router.get("/login", function (req, res) {
    res.render("pages/login")
});

router.get("/cadastro-dados-pessoais", function (req, res) {
    res.render("pages/cadastro-dados-pessoais")
});

router.get("/cadastro-preferenciais", function (req, res) {
    res.render("pages/cadastro-preferenciais")
});

router.get("/cadastro-verificacao", function (req, res) {
    res.render("pages/cadastro-verificacao")
});

router.get("/bairro-bras", function (req, res) {
    res.render("pages/bairro-bras")
});

router.get("/bairro-pinheiros", function (req, res) {
    res.render("pages/bairro-pinheiros")
});


module.exports = router;