// Tela de preferencias (bairros acompanhados, categorias e frequencia).
// Requer sessao: e aqui que o usuario identificado salva o que quer acompanhar.
const { validationResult } = require("express-validator");

const preferenciaModel = require("../models/preferenciaModel");
const bairroModel = require("../models/bairroModel");
const { mensagens } = require("../helpers/errosValidacao");
const { usuarioDaSessao } = require("../middlewares/exigirAutenticacao");

const LIMITE_BAIRROS = 20;

// O formulario manda array, mas um unico item chega como string.
function normalizarLista(valor) {
  if (valor === undefined || valor === null || valor === "") return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista.map((item) => String(item).trim()).filter(Boolean);
}

async function mostrarPreferencias(req, res, next) {
  const usuario = usuarioDaSessao(req);

  try {
    const atuais = await preferenciaModel.listarPreferencias(usuario.id);

    // Primeiro acesso: sugere o bairro escolhido no cadastro.
    const bairrosIniciais = [...atuais.bairros];
    const bairroSugeridoId = req.session?.bairroSugerido;
    if (!bairrosIniciais.length && bairroSugeridoId) {
      const sugerido = await bairroModel.buscarPorId(bairroSugeridoId);
      if (sugerido) bairrosIniciais.push({ id: sugerido.id, nome: sugerido.nome });
    }

    return res.render("pages/cadastro-preferencias", {
      preferenciasIniciais: {
        bairros: bairrosIniciais,
        categorias: atuais.categorias.map((categoria) => categoria.slug),
        frequencia: atuais.frequencia,
      },
      erros: [],
    });
  } catch (erro) {
    return next(erro);
  }
}

async function mostrarBoasVindas(req, res, next) {
  const usuario = usuarioDaSessao(req);

  try {
    // Consulta os bairros salvos da conta logada, nao a sugestao do cadastro.
    const preferencias = await preferenciaModel.listarPreferencias(usuario.id);
    const resumoBairros = preferencias.bairros.map((bairro) => bairro.nome).join(", ");

    return res.render("pages/welcome", {
      resumoBairros: resumoBairros || "Nenhum bairro selecionado",
    });
  } catch (erro) {
    return next(erro);
  }
}

async function salvarPreferencias(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return res.status(422).json({ erros: mensagens(resultado) });
  }

  const usuario = usuarioDaSessao(req);
  const bairros = normalizarLista(req.body.bairros);

  if (bairros.length > LIMITE_BAIRROS) {
    return res
      .status(422)
      .json({ erros: [`Escolha no máximo ${LIMITE_BAIRROS} bairros.`] });
  }

  try {
    const salvo = await preferenciaModel.salvarPreferencias(usuario.id, {
      bairroIds: bairros,
      categoriaSlugs: normalizarLista(req.body.categorias),
      frequencia: req.body.frequencia,
    });

    if (req.session) delete req.session.bairroSugerido;

    return res.status(200).json({
      ok: true,
      mensagem: "Preferências salvas com sucesso.",
      ...salvo,
      redirecionar: "/welcome",
    });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { mostrarPreferencias, mostrarBoasVindas, salvarPreferencias, normalizarLista };
