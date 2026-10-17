const express = require("express");

const {
  exigirAutenticacao,
  exigirPapel,
  exigirEmailVerificado,
} = require("../middlewares/exigirAutenticacao");

const router = express.Router();
const { listarModeracao, detalheModeracao, alterarModeracao, alterarSituacao } = require("../controllers/relatoConsultaControllers");
const { exigirCsrfRelatos } = require("../middlewares/csrfRelatos");
const admin = require("../controllers/adminControllers");
const relatorios = require("../controllers/relatorioControllers");
const investimentos = require("../controllers/investimentoControllers");
const midias = require("../controllers/midiaControllers");

router.use(["/api/adm/usuarios", "/api/adm/dashboard"], admin.semCache,
  exigirAutenticacao, exigirEmailVerificado, exigirPapel("moderador"));
router.get("/api/adm/usuarios", admin.listarUsuarios);
router.patch("/api/adm/usuarios/:publicId/status", exigirCsrfRelatos, admin.alterarStatus);
router.get("/api/adm/dashboard", admin.dashboard);

router.use("/api/adm/investimentos", admin.semCache, exigirAutenticacao, exigirEmailVerificado, exigirPapel("moderador"));
router.get("/api/adm/investimentos", investimentos.consultar);

// Exportação é somente leitura, mas nunca pública: contém também relatos em moderação.
router.use("/api/adm/relatorios", admin.semCache, exigirAutenticacao, exigirEmailVerificado, exigirPapel("moderador"));
router.get("/api/adm/relatorios/filtros", relatorios.filtros);
router.get("/api/adm/relatorios/relatos.csv", relatorios.exportar);

router.use("/api/adm/relatos", exigirAutenticacao, exigirEmailVerificado, exigirPapel("moderador"));
router.get("/api/adm/relatos", listarModeracao);
router.get("/api/adm/relatos/:publicId/midias", midias.listarModeracao);
router.get("/api/adm/relatos/:publicId/midias/:midiaId", midias.listarModeracao);
router.post("/api/adm/relatos/:publicId/moderacao", exigirCsrfRelatos, alterarModeracao);
router.patch("/api/adm/relatos/:publicId/situacao", exigirCsrfRelatos, alterarSituacao);

// ---------------------------------------------------------------------------
// Antes: TODAS as rotas /adm eram públicas (qualquer pessoa com a URL entrava).
// Agora: primeiro exige login, depois e-mail verificado, depois o papel.
// Hierarquia (README 5.4): administrador herda moderador, que herda cidadão.
// ---------------------------------------------------------------------------
router.use("/adm", exigirAutenticacao, exigirEmailVerificado);

// Moderação aceita moderador e administrador.
router.get("/adm/moderacao", exigirPapel("moderador"), (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("pages/adm-moderacao");
});
router.get("/adm/moderacao/:publicId", exigirPapel("moderador"), detalheModeracao);

// Decisão de 16/10/2026: moderador também acessa todas as áreas do painel.
router.get("/adm", exigirPapel("moderador"), (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("pages/adm-dashboard");
});

router.get("/adm/relatos", exigirPapel("moderador"), (req, res) => {
  // Reutiliza a consulta real, em vez da antiga tabela de demonstracao.
  res.redirect(303, "/adm/moderacao?decisao=todos");
});

router.get("/adm/usuarios", exigirPapel("moderador"), (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("pages/adm-usuarios");
});

router.get("/adm/investimentos", exigirPapel("moderador"), (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("pages/adm-investimentos");
});

router.get("/adm/relatorios", exigirPapel("moderador"), (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("pages/adm-relatorios");
});

module.exports = router;
