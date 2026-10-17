// Controlador de autenticacao: cadastro, conferencia do codigo, login e logout.
// (Antes este arquivo apenas validava e ecoava JSON sem persistir nada.)
const crypto = require("node:crypto");
const { validationResult } = require("express-validator");

const usuarioModel = require("../models/usuarioModel");
const verificacaoModel = require("../models/verificacaoModel");
const preferenciaModel = require("../models/preferenciaModel");
const bairroModel = require("../models/bairroModel");
const { emitirCodigoCadastro } = require("../services/verificacaoEmailService");

const { gerarHash, conferirSenha } = require("../helpers/senha");
const { mensagens } = require("../helpers/errosValidacao");
const {
  mascararEmail,
  segundosRestantes,
  COOLDOWN_REENVIO_SEGUNDOS,
} = require("../helpers/codigoVerificacao");

const { iniciarSessaoAutenticada, encerrarSessao } = require("../middlewares/exigirAutenticacao");
const {
  guardarCadastroPendente,
  cadastroPendente,
} = require("../middlewares/exigirCadastroPendente");

const VALORES_VAZIOS = { nome: "", sobrenome: "", email: "", bairro: "", bairroNome: "" };

// A LGPD pede minimizacao: guardamos o hash do IP, nunca o IP em texto puro.
function hashDeIp(req) {
  const ip = req.ip ?? req.socket?.remoteAddress ?? "";
  return crypto
    .createHash("sha256")
    .update(`${process.env.SESSION_SECRET ?? "climafy"}${ip}`)
    .digest("hex");
}

// Evita open redirect: so aceitamos caminhos internos ("/algo", nunca "//site").
function destinoSeguro(valor) {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/") || valor.startsWith("//")) return null;
  // Navegadores tratam barra invertida como barra; controles podem ser ignorados.
  if (/[\\\u0000-\u001f\u007f]/.test(valor)) return null;
  return valor;
}

function renderizarCadastro(res, { erros = [], valores = VALORES_VAZIOS, status = 200 } = {}) {
  return res.status(status).render("pages/cadastro-dados-pessoais", { erros, valores });
}

function mostrarCadastro(req, res) {
  return renderizarCadastro(res);
}

async function processarCadastro(req, res, next) {
  const { nome, sobrenome, email, senha, bairro } = req.body;
  const valores = {
    nome: nome ?? "",
    sobrenome: sobrenome ?? "",
    email: email ?? "",
    bairro: bairro ?? "",
    // Nome do bairro volta para o campo de busca quando o formulário é
    // re-renderizado com erro de validação.
    bairroNome: req.body["bairro-nome"] ?? "",
  };

  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return renderizarCadastro(res, { erros: mensagens(resultado), valores, status: 422 });
  }

  try {
    if (await usuarioModel.emailJaExiste(email)) {
      return renderizarCadastro(res, {
        erros: ["Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail."],
        valores,
        status: 422,
      });
    }

    // O campo bairro do formulario e o ID vindo do autocomplete /api/bairros.
    const bairroEscolhido = await bairroModel.buscarPorId(bairro);
    if (!bairroEscolhido) {
      return renderizarCadastro(res, {
        erros: ["Selecione um bairro da lista sugerida."],
        valores: { ...valores, bairro: "" },
        status: 422,
      });
    }

    const senhaHash = await gerarHash(senha);

    const usuario = await usuarioModel.criarUsuario({
      nome,
      sobrenome,
      email,
      senhaHash,
      ipHash: hashDeIp(req),
      userAgent: req.get("user-agent"),
    });

    // A conta ja existe. Guardar a etapa ANTES do SMTP permite retomar/reenviar
    // mesmo que o provedor falhe. Isso NAO autentica nem verifica o usuario.
    guardarCadastroPendente(req, { usuarioId: usuario.id, email: usuario.email });
    // Bairro escolhido no cadastro vira sugestao na tela de preferencias.
    req.session.bairroSugerido = bairroEscolhido.id;
    const emissao = await emitirCodigoCadastro({ usuarioId: usuario.id, email: usuario.email });
    if (!emissao.enviado) {
      req.session.aviso = "Sua conta foi criada e aguarda verificação. Não conseguimos confirmar o envio do e-mail. Se não receber, use Reenviar código.";
      req.session.avisoTipo = "error";
    } else {
      delete req.session.aviso;
      delete req.session.avisoTipo;
    }

    return res.redirect(303, "/cadastro-verificacao");
  } catch (erro) {
    if (erro?.code === "ER_DUP_ENTRY") {
      return renderizarCadastro(res, {
        erros: ["Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail."],
        valores,
        status: 422,
      });
    }
    return next(erro);
  }
}

async function mostrarVerificacao(req, res, next) {
  const pendente = cadastroPendente(req);
  if (!pendente) return res.redirect(303, "/cadastro-dados-pessoais");

  try {
    // O tempo mostrado na tela vem do banco (expira_em), nao de um contador
    // inventado no navegador.
    const codigoAtual = await verificacaoModel.buscarPendente(pendente.usuarioId, "cadastro");
    const aviso = req.session?.aviso ?? null;
    const avisoTipo = req.session?.avisoTipo ?? "success";
    if (req.session) delete req.session.aviso;
    if (req.session) delete req.session.avisoTipo;

    return res.render("pages/cadastro-verificacao", {
      email: pendente.email,
      emailMascarado: mascararEmail(pendente.email),
      segundosRestantes: codigoAtual ? segundosRestantes(codigoAtual.expira_em) : 0,
      cooldownReenvio: COOLDOWN_REENVIO_SEGUNDOS,
      erros: [],
      aviso,
      avisoTipo,
    });
  } catch (erro) {
    return next(erro);
  }
}

function mostrarLogin(req, res) {
  const avisoDaSessao = req.session?.aviso ?? null;
  if (req.session) delete req.session.aviso;

  // Vem do /api/verificacao depois de confirmar o código (Opção A do README).
  const aviso =
    avisoDaSessao ??
    (req.query.verificado === "1"
      ? "E-mail confirmado! Entre com a sua senha para continuar."
      : null);

  return res.render("pages/login", {
    erros: [],
    aviso,
    email: typeof req.query.email === "string" ? req.query.email : "",
    proximo: destinoSeguro(req.query.proximo) ?? "",
  });
}

async function processarLogin(req, res, next) {
  const { email, senha } = req.body;
  const proximo = destinoSeguro(req.body.proximo) ?? "";

  const renderizar = (status, erros) =>
    res.status(status).render("pages/login", {
      erros,
      aviso: null,
      email: email ?? "",
      proximo,
    });

  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return renderizar(401, mensagens(resultado));
  }

  try {
    const usuario = await usuarioModel.buscarPorEmail(email);
    const senhaCorreta = usuario ? await conferirSenha(senha, usuario.senha_hash) : false;

    // Mensagem unica para e-mail inexistente e senha errada: nao revela quais
    // e-mails existem na base.
    if (!usuario || !senhaCorreta) {
      return renderizar(401, ["E-mail ou senha inválidos."]);
    }

    if (usuario.status !== "ativo") {
      return renderizar(403, ["Sua conta está bloqueada. Fale com a equipe do ClimaFy."]);
    }

    if (!usuario.email_verificado_em) {
      // A senha ja foi conferida; permite retomar uma conta nao verificada.
      guardarCadastroPendente(req, { usuarioId: usuario.id, email: usuario.email });
      const emissao = await emitirCodigoCadastro({ usuarioId: usuario.id, email: usuario.email });
      req.session.aviso = emissao.enviado
        ? "Confirme seu e-mail para entrar. Enviamos um novo código."
        : "Sua conta aguarda verificação. Não conseguimos confirmar o envio do e-mail. Se não receber, use Reenviar código.";
      req.session.avisoTipo = emissao.enviado ? "success" : "error";
      return res.redirect(303, "/cadastro-verificacao");
    }

    const jaTemPreferencias = await preferenciaModel.temPreferencias(usuario.id);
    const destino = proximo || (jaTemPreferencias ? "/" : "/cadastro-preferencias");
    await iniciarSessaoAutenticada(req, usuario);

    // Ultimo acesso e "cortesia": se falhar, nao impede o login.
    try {
      await usuarioModel.registrarAcesso(usuario.id);
    } catch (erroAcesso) {
      console.error("Falha ao registrar ultimo acesso:", erroAcesso.message);
    }

    return res.redirect(303, destino);
  } catch (erro) {
    return next(erro);
  }
}

async function processarLogout(req, res) {
  await encerrarSessao(req);
  res.clearCookie("climafy.sid", { path: "/" });
  return res.redirect(303, "/");
}

module.exports = {
  mostrarCadastro,
  processarCadastro,
  mostrarVerificacao,
  mostrarLogin,
  processarLogin,
  processarLogout,
  destinoSeguro,
  hashDeIp,
};
