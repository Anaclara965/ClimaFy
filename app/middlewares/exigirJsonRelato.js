// Criação sem anexo e edição recebem JSON. O middleware receberMidiaRelato
// trata separadamente multipart somente na criação; a edição continua JSON.
function exigirJsonRelato(req, res, next) {
  if (!req.is("application/json")) {
    return res.status(415).json({ erros: ["Envie o relato em application/json."] });
  }
  const dados = req.body;
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return res.status(422).json({ erros: ["Envie um objeto com os campos do relato."] });
  }
  const textos = ["titulo", "descricao", "categoria", "severidade", "referencia"];
  const numeros = ["bairro", "latitude", "longitude"];
  const invalidos = [...textos, ...numeros].filter((campo) => {
    if (dados[campo] === undefined) return false; // Obrigatoriedade: validators.
    return textos.includes(campo)
      ? typeof dados[campo] !== "string"
      : !["string", "number"].includes(typeof dados[campo]);
  });
  if (invalidos.length) {
    return res.status(422).json({ erros: invalidos.map((campo) => `Formato inválido: ${campo}.`) });
  }
  return next();
}

module.exports = { exigirJsonRelato };
