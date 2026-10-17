const express = require("express");
const { criarRelato } = require("../controllers/relatoControllers");
const midias = require("../controllers/midiaControllers");
const { receberMidiaRelato } = require("../middlewares/receberMidiaRelato");
const { exigirJsonRelato } = require("../middlewares/exigirJsonRelato");
const { listarPublicos, listarMeus, detalhePublico, detalheMeu } = require("../controllers/relatoConsultaControllers");
const { buscarEndereco, identificarLocal } = require("../controllers/localizacaoControllers");

const { listarBairros } = require("../controllers/bairroControllers");
const {
  mostrarCadastro,
  processarCadastro,
  mostrarVerificacao,
  mostrarLogin,
  processarLogin,
  processarLogout,
} = require("../controllers/controllers");
const { confirmarCodigo, reenviarCodigo } = require("../controllers/verificacaoControllers");
const {
  mostrarPreferencias,
  mostrarBoasVindas,
  salvarPreferencias,
} = require("../controllers/preferenciasControllers");

const {
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
} = require("../helpers/validacoesCadastro");

const {
  validarTitulo,
  validarDescricao,
  validarSeveridade,
  validarReferencia,
  validarBairroRelato,
  validarCategoria,
  validarLatitude,
  validarLongitude
} = require("../helpers/validacoesRelatos");

const { exigirAutenticacao, exigirPapel } = require("../middlewares/exigirAutenticacao");
const { criarLimiteLogin } = require("../middlewares/limitarLogin");
const { exigirCsrfRelatos } = require("../middlewares/csrfRelatos");
const { consultarVotos, votar, retirarVoto } = require("../controllers/votoControllers");
const { mostrarEdicao, editarRelato, excluirRelato } = require("../controllers/relatoAutorControllers");
const notificacoes = require("../controllers/notificacaoControllers");
const ranking = require("../controllers/rankingControllers");
const {
  exigirCadastroPendente,
  redirecionarSeLogado,
} = require("../middlewares/exigirCadastroPendente");

const router = express.Router();

const { mostrarRecuperacao, solicitarRecuperacao, redefinirSenha } = require("../controllers/recuperacaoSenhaControllers");
const { exigirCsrfRecuperacao, criarLimiteRecuperacao } = require("../middlewares/protegerRecuperacaoSenha");
const { validarEmailRecuperacao, validarCodigoRecuperacao, validarNovaSenha,
  validarConfirmacaoNovaSenha } = require("../helpers/validacoesRecuperacaoSenha");

router.get("/recuperar-senha", mostrarRecuperacao);
router.post("/recuperar-senha", exigirCsrfRecuperacao, criarLimiteRecuperacao(),
  validarEmailRecuperacao, solicitarRecuperacao);
router.post("/resetar-senha", exigirCsrfRecuperacao, criarLimiteRecuperacao({ limite: 30 }),
  [validarEmailRecuperacao, validarCodigoRecuperacao, validarNovaSenha, validarConfirmacaoNovaSenha], redefinirSenha);

// ===========================================================================
// Públicas (README 5.3)
// ===========================================================================
router.get("/", (req, res) => res.render("pages/index"));
router.get("/sobre", (req, res) => res.render("pages/sobre"));
router.get("/relatos", (req, res) => res.render("pages/relatos"));
router.get("/relatos/:publicId", detalhePublico);
router.get("/api/relatos", listarPublicos);
router.get("/api/relatos/:publicId/midias", midias.listarPublico);
router.get("/api/relatos/:publicId/midias/:midiaId", midias.listarPublico);
router.get("/api/relatos/:publicId", detalhePublico);
router.get("/ranking", (req, res) => res.render("pages/ranking"));
router.get("/api/ranking", ranking.consultar);
router.get("/bairro-bras", (req, res) => res.render("pages/bairro-bras"));
router.get("/bairro-pinheiros", (req, res) => res.render("pages/bairro-pinheiros"));

// Fonte única dos bairros (autocomplete do cadastro + preferências).
router.get("/api/bairros", listarBairros);

// ===========================================================================
// Cadastro -> verificação -> login -> preferências (README 4.1)
// ===========================================================================
router.get("/cadastro-dados-pessoais", redirecionarSeLogado, mostrarCadastro);

router.post(
  "/cadastro-dados-pessoais",
  [
    validarNome,
    validarSobrenome,
    validarEmail,
    validarBairro,
    validarSenha,
    validarConfirmacaoSenha,
    validarTermos,
  ],
  processarCadastro
);

// Exige uma conta criada nesta sessão: não dá para "pular" a etapa de dados.
router.get("/cadastro-verificacao", redirecionarSeLogado, exigirCadastroPendente, mostrarVerificacao);
router.post("/api/verificacao", exigirCadastroPendente, [validarCodigo], confirmarCodigo);
router.post("/api/verificacao/reenviar", exigirCadastroPendente, reenviarCodigo);

router.get("/login", redirecionarSeLogado, mostrarLogin);
router.post("/login", criarLimiteLogin(), [validarEmailLogin, validarSenhaLogin], processarLogin);
router.post("/logout", processarLogout);
// Link direto no header (GET => apenas encerra a sessão e volta para a home).
router.get("/logout", processarLogout);

// ===========================================================================
// Áreas privadas
// ===========================================================================
router.use("/api/notificacoes", notificacoes.semCache, exigirAutenticacao, exigirPapel("cidadao"));
router.get("/api/notificacoes", notificacoes.listar);
router.patch("/api/notificacoes/lida", exigirCsrfRelatos, notificacoes.marcarLida);
router.get("/cadastro-preferencias", exigirAutenticacao, mostrarPreferencias);
// Endereço antigo, com erro de nome, mantido por compatibilidade.
router.get("/cadastro-preferenciais", (req, res) => res.redirect(301, "/cadastro-preferencias"));
router.post(
  "/api/preferencias",
  exigirAutenticacao,
  [validarBairrosPreferencia, validarFrequencia],
  salvarPreferencias
);

router.get("/welcome", exigirAutenticacao, mostrarBoasVindas);
router.get("/new-report", exigirAutenticacao, (req, res) => res.render("pages/new-report"));
router.get("/meus-relatos", exigirAutenticacao, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("pages/meus-relatos");
});
router.get("/meus-relatos/:publicId", exigirAutenticacao, detalheMeu);
router.get("/meus-relatos/:publicId/editar", exigirAutenticacao, exigirPapel("cidadao"), mostrarEdicao);
router.get("/api/meus-relatos/:publicId", exigirAutenticacao, detalheMeu);
router.get("/api/meus-relatos", exigirAutenticacao, listarMeus);
router.get("/api/meus-relatos/:publicId/midias", exigirAutenticacao, exigirPapel("cidadao"), midias.listarMeu);
router.get("/api/meus-relatos/:publicId/midias/:midiaId", exigirAutenticacao, exigirPapel("cidadao"), midias.listarMeu);
router.get("/api/relatos/envio/configuracao", exigirAutenticacao, exigirPapel("cidadao"), midias.configuracao);
router.put("/api/meus-relatos/:publicId", exigirAutenticacao, exigirPapel("cidadao"), exigirCsrfRelatos, exigirJsonRelato,
  [validarTitulo, validarDescricao, validarSeveridade, validarReferencia, validarBairroRelato,
    validarCategoria, validarLatitude, validarLongitude], editarRelato);
router.delete("/api/meus-relatos/:publicId", exigirAutenticacao, exigirPapel("cidadao"), exigirCsrfRelatos, excluirRelato);
router.get("/api/votos", exigirAutenticacao, exigirPapel("cidadao"), consultarVotos);
router.put("/api/relatos/:publicId/voto", exigirAutenticacao, exigirPapel("cidadao"), exigirCsrfRelatos, votar);
router.delete("/api/relatos/:publicId/voto", exigirAutenticacao, exigirPapel("cidadao"), exigirCsrfRelatos, retirarVoto);
router.get("/api/localizacao/endereco", exigirAutenticacao, buscarEndereco);
router.post("/api/localizacao/ponto", exigirAutenticacao, identificarLocal);

router.post(
  "/api/relatos",
  exigirAutenticacao,
  exigirPapel("cidadao"),
  receberMidiaRelato,
  [validarTitulo, validarDescricao, validarSeveridade, validarReferencia,
    validarBairroRelato, validarCategoria, validarLatitude, validarLongitude],
  criarRelato
);

module.exports = router;
