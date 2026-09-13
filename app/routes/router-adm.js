const express = require("express");

// COMENTÁRIO PRO CARINHA DO BACK: TODAS as rotas abaixo precisam de middleware
// de autenticação + verificação de papel ('administrador'/'moderador').
// Adicionar `exigirPapel(...)` como primeiro middleware de cada rota.
const router = express.Router();

router.get("/adm", function (req, res) {
    res.render("pages/adm-dashboard")
});

router.get("/adm/moderacao", function (req, res) {
    res.render("pages/adm-moderacao")
});

router.get("/adm/relatos", function (req, res) {
    res.render("pages/adm-relatos")
});

router.get("/adm/usuarios", function (req, res) {
    res.render("pages/adm-usuarios")
});

router.get("/adm/investimentos", function (req, res) {
    res.render("pages/adm-investimentos")
});

router.get("/adm/relatorios", function (req, res) {
    res.render("pages/adm-relatorios")
});


module.exports = router;
