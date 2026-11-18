const { validationResult } = require("express-validator");
const usuarioModel = require("../models/usuarioModel");
const { conferirSenha, gerarHash } = require("../helpers/senha");
const { mensagens } = require("../helpers/errosValidacao");
const { usuarioDaSessao, assinaturaSenha } = require("../middlewares/exigirAutenticacao");
const { tokenConta } = require("../middlewares/csrfConta");
const verificacaoModel = require("../models/verificacaoModel");
const { gerarCodigo, hashCodigo, calcularExpiracao } = require("../helpers/codigoVerificacao");
const emailService = require("../services/emailService");
const midiaService = require("../services/midiaService");
const { identificarArquivo, erroMidia } = require("../helpers/midiaRelato");

function renderizarPerfil(req, res, usuario, { erros = [], status = 200, aviso = null } = {}) {
  res.set("Cache-Control", "no-store");
  return res.status(status).render("pages/alterar-perfil", {
    usuario: { ...usuario, papel: usuarioDaSessao(req)?.papel || usuario.papel },
    erros,
    aviso,
    csrfConta: tokenConta(req),
  });
}

async function mostrarPerfil(req, res, next) {
  try {
    const usuario = await usuarioModel.buscarPerfilPorId(usuarioDaSessao(req).id);
    if (!usuario) {
      return res.status(404).render("pages/erro", {
        status: 404, titulo: "Conta não encontrada", mensagem: "Entre novamente para acessar sua conta.",
      });
    }
    const aviso = req.session.avisoConta ?? null;
    delete req.session.avisoConta;
    return renderizarPerfil(req, res, usuario, { aviso });
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarPerfil(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    try {
      const usuario = await usuarioModel.buscarPerfilPorId(usuarioDaSessao(req).id);
      if (!usuario) {
        return res.status(404).render("pages/erro", {
          status: 404, titulo: "Conta não encontrada", mensagem: "Entre novamente para acessar sua conta.",
        });
      }
      return renderizarPerfil(req, res, {
        ...usuario,
        nome: typeof req.body.nome === "string" ? req.body.nome : usuario.nome,
        sobrenome: typeof req.body.sobrenome === "string" ? req.body.sobrenome : usuario.sobrenome,
        telefone: typeof req.body.telefone === "string" ? req.body.telefone : usuario.telefone,
      }, { erros: mensagens(resultado), status: 422 });
    } catch (erro) {
      return next(erro);
    }
  }

  try {
    const identidade = usuarioDaSessao(req);
    const telefone = req.body.telefone.trim();
    await usuarioModel.atualizarPerfil(identidade.id, {
      nome: req.body.nome.trim(),
      sobrenome: req.body.sobrenome.trim(),
      telefone: telefone ? `${telefone.startsWith("+") ? "+" : ""}${telefone.replace(/\D/g, "")}` : null,
    });
    req.session.usuario.nome = req.body.nome.trim();
    req.session.avisoConta = "Seus dados foram atualizados.";
    return res.redirect(303, "/alterar-perfil");
  } catch (erro) {
    return next(erro);
  }
}

async function renderizarErroPerfil(req, res, next, erro, status = 422) {
  try {
    const usuario = await usuarioModel.buscarPerfilPorId(usuarioDaSessao(req).id);
    if (!usuario) {
      return res.status(404).render("pages/erro", {
        status: 404, titulo: "Conta não encontrada", mensagem: "Entre novamente para acessar sua conta.",
      });
    }
    return renderizarPerfil(req, res, usuario, { erros: [erro], status });
  } catch (falha) {
    return next(falha);
  }
}

async function solicitarAlteracaoEmail(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return renderizarErroPerfil(req, res, next, mensagens(resultado).join(" "));
  }
  try {
    const codigo = gerarCodigo();
    const emissao = await verificacaoModel.solicitarAlteracaoEmail({
      usuarioId: usuarioDaSessao(req).id,
      email: req.body.emailNovo,
      codigoHash: hashCodigo(codigo),
      expiraEm: calcularExpiracao(),
    });
    const mensagensPorMotivo = {
      conta_indisponivel: "Esta conta não está disponível para alterar o e-mail.",
      email_atual: "Esse já é o e-mail atual da sua conta.",
      email_em_uso: "Esse e-mail já está associado a outra conta.",
      limite: "Aguarde 60 segundos antes de pedir outro código. O limite é de 5 envios por hora.",
    };
    if (!emissao.ok) {
      return renderizarErroPerfil(req, res, next, mensagensPorMotivo[emissao.motivo] || "Não foi possível solicitar a alteração do e-mail.");
    }

    let enviado = false;
    try {
      const retorno = await emailService.enviarCodigoVerificacao(emissao.email, codigo, { finalidade: "alteracao_email" });
      enviado = retorno?.enviado === true;
    } catch {
      console.warn("[conta] Não foi possível confirmar o envio do código de alteração de e-mail.");
    }
    req.session.avisoConta = enviado
      ? "Enviamos um código para o novo e-mail. A alteração só será concluída após a confirmação."
      : "O pedido foi registrado, mas não foi possível confirmar o envio. Você pode tentar novamente após 60 segundos.";
    return res.redirect(303, "/alterar-perfil");
  } catch (erro) {
    return next(erro);
  }
}

async function confirmarAlteracaoEmail(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return renderizarErroPerfil(req, res, next, mensagens(resultado).join(" "));
  }
  try {
    const confirmacao = await verificacaoModel.confirmarAlteracaoEmail({
      usuarioId: usuarioDaSessao(req).id,
      codigo: req.body.codigoEmail,
    });
    const mensagensPorMotivo = {
      formato: "Informe os 6 dígitos do código.",
      conta_indisponivel: "Esta conta não está disponível para alterar o e-mail.",
      sem_email_pendente: "Solicite primeiro a alteração do novo e-mail.",
      email_em_uso: "Esse e-mail já está associado a outra conta. Solicite outro endereço.",
      sem_codigo: "Não há um código válido. Solicite um novo código.",
      expirado: "O código expirou. Solicite um novo código.",
      tentativas: "O código foi bloqueado por excesso de tentativas. Solicite outro.",
      incorreto: `Código incorreto. Restam ${confirmacao.restantes} tentativa(s).`,
    };
    if (!confirmacao.ok) {
      return renderizarErroPerfil(req, res, next, mensagensPorMotivo[confirmacao.motivo] || "Não foi possível confirmar o novo e-mail.");
    }
    req.session.usuario.email = confirmacao.email;
    req.session.avisoConta = "E-mail alterado e confirmado com sucesso.";
    return res.redirect(303, "/alterar-perfil");
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarFotoPerfil(req, res, next) {
  if (!req.file) {
    return renderizarErroPerfil(req, res, next, "Selecione uma foto JPEG ou PNG de até 5 MB.");
  }
  let novaFoto;
  try {
    identificarArquivo(req.file);
    if (!midiaService.disponivel()) throw erroMidia("O envio de foto ainda não está configurado.", 503);
    novaFoto = await midiaService.salvarPerfil(req.file);
    const anterior = await usuarioModel.atualizarFotoPerfil(usuarioDaSessao(req).id, novaFoto);
    req.session.usuario.temFotoPerfil = true;
    if (anterior.foto_perfil_chave) {
      try {
        await midiaService.removerPerfil({
          tipo: "foto",
          chave_arquivo: anterior.foto_perfil_chave,
          mime_type: anterior.foto_perfil_mime_type,
          tamanho_bytes: anterior.foto_perfil_tamanho_bytes,
        });
      } catch {
        console.warn("[perfil] Não foi possível remover a foto anterior.");
      }
    }
    req.session.avisoConta = "Foto de perfil atualizada.";
    return res.redirect(303, "/alterar-perfil");
  } catch (erro) {
    if (novaFoto) {
      try { await midiaService.removerPerfil(novaFoto); }
      catch { console.warn("[perfil] Não foi possível limpar a foto enviada após falha."); }
    }
    if (erro.previsto) return renderizarErroPerfil(req, res, next, erro.message, erro.status);
    return next(erro);
  }
}

async function removerFotoPerfil(req, res, next) {
  try {
    const usuario = await usuarioModel.buscarPerfilPorId(usuarioDaSessao(req).id);
    if (!usuario) {
      return res.status(404).render("pages/erro", {
        status: 404, titulo: "Conta não encontrada", mensagem: "Entre novamente para acessar sua conta.",
      });
    }
    req.session.usuario.temFotoPerfil = Boolean(usuario.foto_perfil_chave);
    if (usuario.foto_perfil_chave) {
      await usuarioModel.limparFotoPerfil(usuario.id);
      try {
        await midiaService.removerPerfil({
          tipo: "foto",
          chave_arquivo: usuario.foto_perfil_chave,
          mime_type: usuario.foto_perfil_mime_type,
          tamanho_bytes: usuario.foto_perfil_tamanho_bytes,
        });
      } catch {
        console.warn("[perfil] Não foi possível remover a foto excluída.");
      }
    }
    req.session.avisoConta = "Foto de perfil removida.";
    return res.redirect(303, "/alterar-perfil");
  } catch (erro) {
    return next(erro);
  }
}

async function fotoPerfil(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  try {
    const usuario = await usuarioModel.buscarPerfilPorId(usuarioDaSessao(req).id);
    if (!usuario?.foto_perfil_chave) return res.status(404).end();
    const foto = {
      tipo: "foto",
      chave_arquivo: usuario.foto_perfil_chave,
      mime_type: usuario.foto_perfil_mime_type,
      tamanho_bytes: usuario.foto_perfil_tamanho_bytes,
    };
    const conteudo = await midiaService.lerPerfil(foto);
    res.set("Content-Type", foto.mime_type);
    res.set("Content-Length", String(conteudo.length));
    res.set("Content-Disposition", 'inline; filename="perfil"');
    return res.send(conteudo);
  } catch (erro) {
    if (erro.previsto) return res.status(erro.status).end();
    return next(erro);
  }
}

function renderizarSenha(req, res, { erros = [], status = 200, aviso = null } = {}) {
  res.set("Cache-Control", "no-store");
  return res.status(status).render("pages/alterar-senha", {
    erros, aviso, csrfConta: tokenConta(req),
  });
}

function mostrarAlteracaoSenha(req, res) {
  const aviso = req.session.avisoSenha ?? null;
  delete req.session.avisoSenha;
  return renderizarSenha(req, res, { aviso });
}

async function alterarSenha(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return renderizarSenha(req, res, { erros: mensagens(resultado), status: 422 });
  }

  try {
    const identidade = usuarioDaSessao(req);
    const usuario = await usuarioModel.buscarPorId(identidade.id);
    if (!usuario || !(await conferirSenha(req.body.senhaAtual, usuario.senha_hash))) {
      return renderizarSenha(req, res, {
        erros: ["A senha atual está incorreta."],
        status: 422,
      });
    }

    const senhaHash = await gerarHash(req.body.novaSenha);
    await usuarioModel.atualizarSenha(identidade.id, senhaHash);
    req.session.assinaturaSenha = assinaturaSenha({ senha_hash: senhaHash });
    req.session.avisoSenha = "Sua senha foi alterada com sucesso.";
    return res.redirect(303, "/alterar-senha");
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  mostrarPerfil,
  atualizarPerfil,
  solicitarAlteracaoEmail,
  confirmarAlteracaoEmail,
  atualizarFotoPerfil,
  removerFotoPerfil,
  fotoPerfil,
  mostrarAlteracaoSenha,
  alterarSenha,
};
