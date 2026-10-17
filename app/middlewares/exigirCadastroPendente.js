// Guarda de estado das etapas do cadastro.
// Sem conta criada nesta sessao, /cadastro-verificacao e as rotas de codigo
// voltam para o inicio (README 4.2, regra 4: etapas nao sao acessiveis fora de ordem).
const { usuarioDaSessao } = require("./exigirAutenticacao");

function cadastroPendente(req) {
  return req.session?.cadastroPendente ?? null;
}

function guardarCadastroPendente(req, { usuarioId, email }) {
  req.session.cadastroPendente = { usuarioId, email };
}

function limparCadastroPendente(req) {
  if (req.session) delete req.session.cadastroPendente;
}

function exigirCadastroPendente(req, res, next) {
  if (cadastroPendente(req)?.usuarioId) return next();

  if (req.originalUrl.startsWith("/api/")) {
    return res
      .status(400)
      .json({ erro: "Nenhum cadastro em andamento. Comece o cadastro novamente." });
  }

  return res.redirect(303, "/cadastro-dados-pessoais");
}

// Usado pela tela de verificação: quem já está logado não volta para essa etapa.
function redirecionarSeLogado(req, res, next) {
  if (usuarioDaSessao(req)) return res.redirect(303, "/");
  return next();
}

module.exports = {
  cadastroPendente,
  guardarCadastroPendente,
  limparCadastroPendente,
  exigirCadastroPendente,
  redirecionarSeLogado,
};
