// Sessao + permissoes. Primeiro middleware de TODA rota privada
// (era exatamente o que o comentario em app/routes/router-adm.js pedia).
//
// Decisao registrada no README (secao 5.1): o app e server-rendered (EJS), com
// links e POST de formulario, entao a autenticacao e por SESSAO com cookie
// HttpOnly. JWT fica reservado para uma futura API publica sem cookie.
const usuarioModel = require("../models/usuarioModel");
const { createHash } = require("node:crypto");

// Assinatura interna: não armazena a senha nem o bcrypt na sessão/res.locals.
function assinaturaSenha(usuario) {
  return createHash("sha256").update(String(usuario.senha_hash ?? "")).digest("hex");
}

// Hierarquia: quem tem papel maior herda as permissoes do menor.
const NIVEL_PAPEL = { cidadao: 1, moderador: 2, administrador: 3 };

function papelSuficiente(papelUsuario, papelMinimo) {
  const nivelUsuario = NIVEL_PAPEL[papelUsuario] ?? 0;
  const nivelMinimo = NIVEL_PAPEL[papelMinimo] ?? Number.MAX_SAFE_INTEGER;
  return nivelUsuario >= nivelMinimo;
}

function ehRequisicaoDeApi(req) {
  return req.originalUrl.startsWith("/api/") || req.path.startsWith("/api/");
}

function usuarioDaSessao(req) {
  return req.session?.usuario ?? null;
}

// Grava o minimo necessario na sessao (nunca senha_hash).
function guardarUsuarioNaSessao(req, usuario) {
  req.session.usuario = {
    id: usuario.id,
    publicId: usuario.public_id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    emailVerificado: Boolean(usuario.email_verificado_em),
  };
  return req.session.usuario;
}

// Renova o identificador ao entrar. Nao reutiliza a sessao anterior como login.
async function iniciarSessaoAutenticada(req, usuario) {
  const bairroSugerido = req.session?.bairroSugerido;

  await new Promise((resolve, reject) => {
    req.session.regenerate((erro) => (erro ? reject(erro) : resolve()));
  });

  guardarUsuarioNaSessao(req, usuario);
  req.session.assinaturaSenha = assinaturaSenha(usuario);
  // Preserva apenas a sugestao do cadastro, nao a identidade nem outros estados.
  if (bairroSugerido !== undefined) req.session.bairroSugerido = bairroSugerido;

  try {
    // O proximo GET so acontece depois que a nova sessao foi salva.
    await new Promise((resolve, reject) => {
      req.session.save((erro) => (erro ? reject(erro) : resolve()));
    });
  } catch (erro) {
    delete req.session.usuario;
    await encerrarSessao(req);
    throw erro;
  }
}

function encerrarSessao(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((erro) => (erro ? reject(erro) : resolve()));
  });
}

function negar(req, res, { statusApi, mensagem }) {
  if (ehRequisicaoDeApi(req)) {
    return res.status(statusApi).json({ erro: mensagem });
  }

  // Rota de pagina: guarda o destino para voltar depois do login.
  const destino = encodeURIComponent(req.originalUrl);
  return res.redirect(303, `/login?proximo=${destino}`);
}

// A dependencia pode ser substituida nos testes, sem acessar o banco real.
function criarExigirAutenticacao(model = usuarioModel) {
  return async function exigirAutenticacao(req, res, next) {
    const identidade = usuarioDaSessao(req);
    if (!identidade) {
      return negar(req, res, {
        statusApi: 401,
        mensagem: "Você precisa entrar na sua conta para continuar.",
      });
    }

    try {
      // buscarPorId tambem exclui usuarios com deleted_at preenchido.
      const usuario = await model.buscarPorId(identidade.id);
      if (!usuario || usuario.status !== "ativo" || !usuario.email_verificado_em ||
          req.session.assinaturaSenha !== assinaturaSenha(usuario)) {
        delete req.session.usuario;
        res.locals.usuario = null;
        await encerrarSessao(req);
        res.clearCookie("climafy.sid", { path: "/" });
        return negar(req, res, {
          statusApi: 401,
          mensagem: "Sua sessão não é mais válida. Entre novamente.",
        });
      }

      // Uma mudanca de papel vale ja nesta requisicao, antes de exigirPapel.
      res.locals.usuario = guardarUsuarioNaSessao(req, usuario);
      return next();
    } catch (erro) {
      // Falha no banco nao autoriza usando a permissao antiga da sessao.
      return next(erro);
    }
  };
}

const exigirAutenticacao = criarExigirAutenticacao();

function exigirEmailVerificado(req, res, next) {
  const usuario = usuarioDaSessao(req);
  if (usuario?.emailVerificado) return next();

  if (ehRequisicaoDeApi(req)) {
    return res.status(403).json({ erro: "Confirme seu e-mail antes de continuar." });
  }
  return res.redirect(303, "/cadastro-verificacao");
}

// exigirPapel("moderador")  -> moderador e administrador
// exigirPapel("administrador") -> somente administrador
function exigirPapel(papelMinimo) {
  return function verificarPapel(req, res, next) {
    const usuario = usuarioDaSessao(req);

    if (!usuario) {
      return negar(req, res, {
        statusApi: 401,
        mensagem: "Você precisa entrar na sua conta para continuar.",
      });
    }

    if (!papelSuficiente(usuario.papel, papelMinimo)) {
      if (ehRequisicaoDeApi(req)) {
        return res.status(403).json({ erro: "Seu perfil não tem permissão para esta ação." });
      }
      return res.status(403).render("pages/erro", {
        titulo: "Acesso restrito",
        mensagem: "Seu perfil não tem permissão para acessar esta página.",
        status: 403,
      });
    }

    return next();
  };
}

module.exports = {
  assinaturaSenha,
  NIVEL_PAPEL,
  papelSuficiente,
  ehRequisicaoDeApi,
  usuarioDaSessao,
  guardarUsuarioNaSessao,
  iniciarSessaoAutenticada,
  encerrarSessao,
  criarExigirAutenticacao,
  exigirAutenticacao,
  exigirEmailVerificado,
  exigirPapel,
};
