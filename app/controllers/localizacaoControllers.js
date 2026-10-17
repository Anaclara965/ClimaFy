const geocodificacao = require("../services/geocodificacaoService");
const bairroModel = require("../models/bairroModel");

function criarLocalizacaoControllers(servico = geocodificacao, model = bairroModel) {
  function tratarErro(erro, res, next) {
    if ([429, 503].includes(erro.status)) return res.status(erro.status).json({ erro: erro.message });
    return next(erro);
  }
  async function buscarEndereco(req, res, next) {
    res.set("Cache-Control", "no-store");
    const busca = req.query.busca;
    if (typeof busca !== "string" || busca.trim().length < 3 || busca.length > 200) {
      return res.status(400).json({ erro: "Informe um endereço entre 3 e 200 caracteres." });
    }
    try {
      return res.json(await servico.buscarEnderecos(busca.trim()));
    } catch (erro) { return tratarErro(erro, res, next); }
  }
  async function identificarLocal(req, res, next) {
    res.set("Cache-Control", "no-store");
    if (!req.is("application/json")) return res.status(415).json({ erro: "Envie as coordenadas em JSON." });
    const { latitude, longitude } = req.body ?? {};
    const numero = (valor) => ["string", "number"].includes(typeof valor) &&
      String(valor).trim() !== "" && Number.isFinite(Number(valor));
    if (!numero(latitude) || !numero(longitude) ||
        Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180) {
      return res.status(400).json({ erro: "Informe latitude e longitude válidas." });
    }
    try {
      const local = await servico.identificarPonto(Number(latitude), Number(longitude));
      const bairro = local?.pais === "BR"
        ? await model.buscarPorLocalizacao(local) : null;
      return res.json({
        cidade: local?.cidade ?? "", bairro,
        bairroSugerido: local?.bairros?.[0] ?? "",
        mensagem: bairro
          ? "Cidade e bairro preenchidos. Confira o ponto e o bairro antes de enviar."
          : "Não encontramos um bairro correspondente no cadastro. Selecione o bairro na lista; se a cidade não for atendida, use um local dentro da área do projeto.",
      });
    } catch (erro) { return tratarErro(erro, res, next); }
  }
  return { buscarEndereco, identificarLocal };
}
module.exports = { ...criarLocalizacaoControllers(), criarLocalizacaoControllers };
