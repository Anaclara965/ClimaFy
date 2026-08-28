const express = require("express");

const router = express.Router();

router.get("/adm", function (req, res) {
    res.render("pages/adm-dashboard")
});

router.get("/adm-relatos", function (req, res) {
    res.render("pages/adm-relatos")
});

router.get("/adm-usuarios", function (req, res) {
    res.render("pages/adm-usuarios")
});

router.get("/adm-relatorios", function (req, res) {
    res.render("pages/adm-relatorios")
});

router.get("/adm-investimentos", function (req, res) {
    res.render("pages/adm-investimentos")
});

router.get("/adm-moderacao", function (req, res) {
    res.render("pages/adm-moderacao")
});


module.exports = router;
