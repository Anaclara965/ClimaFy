// Conferencia do codigo de 6 digitos e reenvio.
// Toda a decisao e do SERVIDOR: o navegador nunca decide que a conta esta ativa.
const { validationResult } = require("express-validator");

const verificacaoModel = require("../models/verificacaoModel");
const { emitirCodigoCadastro } = require("../services/verificacaoEmailService");
const { mensagens } = require("../helpers/errosValidacao");
const {
  segundosRestantes,
  COOLDOWN_REENVIO_SEGUNDOS,
} = require("../helpers/codigoVerificacao");
const {
  cadastroPendente,
  limparCadastroPendente,
} = require("../middlewares/exigirCadastroPendente");

const FINALIDADE = "cadastro";

async function confirmarCodigo(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return res.status(422).json({ erros: mensagens(resultado) });
  }

  const pendente = cadastroPendente(req);
  if (!pendente) {
    return res.status(400).json({ erro: "Nenhum cadastro em andamento." });
  }

  try {
    const confirmacao = await verificacaoModel.confirmarCadastro({
      usuarioId: pendente.usuarioId,
      codigo: req.body.codigo,
    });
    if (!confirmacao.ok) {
      const mensagensPorMotivo = {
        formato: "Informe os 6 dígitos do código.",
        conta_indisponivel: "Esta conta não está disponível para verificação.",
        ja_verificado: "Este e-mail já foi confirmado. Entre na sua conta.",
        sem_codigo: "Nenhum código ativo. Peça um novo código.",
        expirado: "Este código expirou. Peça um novo código.",
        tentativas: "Muitas tentativas. Peça um novo código.",
        incorreto: `Código incorreto. Restam ${confirmacao.restantes} tentativa(s).`,
      };
      return res.status(422).json({
        erros: [mensagensPorMotivo[confirmacao.motivo] ?? "Não foi possível confirmar o código."],
      });
    }

    // O model so confirma sucesso depois do COMMIT das duas alteracoes.
    limparCadastroPendente(req);

    return res.status(200).json({
      ok: true,
      mensagem: "E-mail confirmado! Agora entre com sua senha.",
      // Opcao A do README: verificacao -> tela de login -> preferencias.
      redirecionar: `/login?email=${encodeURIComponent(pendente.email)}&verificado=1`,
    });
  } catch (erro) {
    return next(erro);
  }
}

async function reenviarCodigo(req, res, next) {
  const pendente = cadastroPendente(req);
  if (!pendente) {
    return res.status(400).json({ erro: "Nenhum cadastro em andamento." });
  }

  try {
    const enviosRecentes = await verificacaoModel.contarEnviosRecentes(
      pendente.usuarioId,
      FINALIDADE,
      COOLDOWN_REENVIO_SEGUNDOS
    );

    if (enviosRecentes > 0) {
      return res.status(429).json({
        erro: `Aguarde ${COOLDOWN_REENVIO_SEGUNDOS} segundos para pedir outro código.`,
        cooldown: COOLDOWN_REENVIO_SEGUNDOS,
      });
    }

    const emissao = await emitirCodigoCadastro({ usuarioId: pendente.usuarioId, email: pendente.email });
    if (!emissao.enviado) {
      return res.status(503).json({
        erro: "Não conseguimos confirmar o envio. Se não receber o código, aguarde e peça novamente.",
        cooldown: COOLDOWN_REENVIO_SEGUNDOS,
      });
    }

    return res.status(200).json({
      ok: true,
      mensagem: "Enviamos um novo código.",
      segundosRestantes: segundosRestantes(emissao.expiraEm),
      cooldown: COOLDOWN_REENVIO_SEGUNDOS,
    });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { confirmarCodigo, reenviarCodigo };
