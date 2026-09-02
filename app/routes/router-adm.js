var express = require('express');
var router = express.Router(); 
const {body, validationResult} = require("express-validator")

router.get("/", function (req, res) {
    res.render("pages/adm-dashboard")
});

router.get("/relatos", function (req, res) {
    res.render("pages/adm-relatos")
});

router.get("/usuarios", function (req, res) {
    res.render("pages/adm-usuarios")
});

router.get("/relatorios", function (req, res) {
    res.render("pages/adm-relatorios")
});

router.get("/investimentos", function (req, res) {
    res.render("pages/adm-investimentos")
});

router.get("/moderacao", function (req, res) {
    res.render("pages/adm-moderacao")
});


module.exports = router;