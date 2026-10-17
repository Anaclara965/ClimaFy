const { validationResult } = require("express-validator");
const model = require("../models/recuperacaoSenhaModel");
const emailService = require("../services/emailService");
const { gerarCodigo, hashCodigo, calcularExpiracao } = require("../helpers/codigoVerificacao");
const { gerarHash } = require("../helpers/senha");
const { tokenRecuperacao } = require("../middlewares/protegerRecuperacaoSenha");

const AVISO_PEDIDO = "Se esse e-mail pertencer a uma conta disponível, você receberá um código válido por 5 minutos. Confira também o spam. Para pedir outro, aguarde pelo menos 60 segundos (máximo de 5 envios por hora).";
const ERRO_CODIGO = "Código inválido, expirado ou sem tentativas disponíveis. Confira o e-mail ou peça um novo código.";

function renderizar(req, res, { etapa = "email", erros = [], aviso = null, status = 200 } = {}) {
  res.set("Cache-Control", "no-store");
  return res.status(status).render("pages/login", {
    recuperacao: etapa, erros, aviso,
    email: typeof req.body?.email === "string" ? req.body.email : "",
    proximo: "", csrfRecuperacao: tokenRecuperacao(req),
  });
}

function mostrarRecuperacao(req, res) {
  return renderizar(req, res);
}

async function solicitarRecuperacao(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) return renderizar(req, res, {
    status: 422, erros: resultado.array().map(erro => erro.msg),
  });
  try {
    const codigo = gerarCodigo();
    const destinatario = await model.emitirCodigo({
      email: req.body.email, codigoHash: hashCodigo(codigo), expiraEm: calcularExpiracao(),
    });
    // A resposta não espera o SMTP: sua demora/falha não revela se a conta existe.
    // O código já está persistido. Falhas são registradas sem senha, código ou e-mail.
    if (destinatario) res.once("finish", () => {
      Promise.resolve().then(() => emailService.enviarCodigoVerificacao(destinatario.email, codigo, {
        finalidade: "recuperacao_senha",
      })).then(envio => {
        if (!envio?.enviado) console.warn("[recuperacao] Envio não confirmado pelo SMTP.");
      }).catch(() => console.warn("[recuperacao] Falha no envio do e-mail."));
    });
    return renderizar(req, res, { etapa: "senha", aviso: AVISO_PEDIDO });
  } catch (erro) { return next(erro); }
}

async function redefinirSenha(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) return renderizar(req, res, {
    etapa: "senha", status: 422, erros: resultado.array().map(erro => erro.msg),
  });
  try {
    const senhaHash = await gerarHash(req.body.senha);
    const alteracao = await model.redefinirSenha({ email: req.body.email, codigo: req.body.codigo, senhaHash });
    if (!alteracao.ok) return renderizar(req, res, { etapa: "senha", status: 422, erros: [ERRO_CODIGO] });
    // Não entra automaticamente. O novo hash também invalida outras sessões no guard.
    await new Promise((resolve, reject) => req.session.regenerate(erro => erro ? reject(erro) : resolve()));
    req.session.aviso = "Senha redefinida! Entre com sua nova senha.";
    await new Promise((resolve, reject) => req.session.save(erro => erro ? reject(erro) : resolve()));
    res.once("finish", () => {
      Promise.resolve().then(() => emailService.enviarEmail({
        para: req.body.email, assunto: "Sua senha do ClimaFy foi alterada",
        texto: "A senha da sua conta ClimaFy foi redefinida. Se não foi você, recupere o acesso e entre em contato com a equipe do projeto. Nunca compartilhe seus códigos de verificação.",
      })).catch(() => console.warn("[recuperacao] Falha no envio do aviso de alteração."));
    });
    return res.redirect(303, "/login");
  } catch (erro) { return next(erro); }
}

module.exports = { mostrarRecuperacao, solicitarRecuperacao, redefinirSenha, AVISO_PEDIDO, ERRO_CODIGO };
