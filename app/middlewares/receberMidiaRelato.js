const multer = require("multer");
const { MAX_BYTES, TIPOS, identificarArquivo } = require("../helpers/midiaRelato");
const service = require("../services/midiaService");
const { exigirTokenRelatos } = require("./csrfRelatos");
const { exigirJsonRelato } = require("./exigirJsonRelato");

function criarReceberMidia({ disponivel = () => service.disponivel(), agora = Date.now } = {}) {
  const pedidos = new Map();
  let ativos = 0;
  const receber = multer({ storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1, fields: 10, parts: 11, fieldSize: 2048, fieldNameSize: 80 },
    fileFilter(req, arquivo, callback) {
      if (!TIPOS[arquivo.mimetype]) return callback(Object.assign(new Error("Tipo não permitido."), { previsto: true }));
      return callback(null, true);
    },
  }).single("foto");

  return function receberMidia(req, res, next) {
    if (!req.is("multipart/form-data")) return exigirJsonRelato(req, res, next);
    res.set("Cache-Control", "no-store");
    return exigirTokenRelatos(req, res, () => {
      if (!disponivel()) return res.status(503).json({ erro: "Anexos ainda não configurados. Envie o relato sem arquivo por enquanto." });
      const tempo = agora();
      for (const [id, entrada] of pedidos) if (entrada.ate <= tempo) pedidos.delete(id);
      const id = String(req.session.usuario.id);
      let entrada = pedidos.get(id);
      if (!entrada && pedidos.size < 5000) {
        entrada = { total: 0, ate: tempo + 3600000 }; pedidos.set(id, entrada);
      }
      if (!entrada || entrada.total >= 10 || ativos >= 2) {
        res.set("Retry-After", String(ativos >= 2 ? 10 : Math.ceil(((entrada?.ate ?? tempo + 3600000) - tempo) / 1000)));
        return res.status(429).json({ erro: "Limite temporário de anexos. Aguarde antes de tentar novamente." });
      }
      entrada.total++;
      ativos++;
      let liberado = false;
      const liberar = () => {
        if (!liberado) { liberado = true; ativos--; res.off("finish", liberar); res.off("close", liberar); }
      };
      // Mantém vaga durante upload externo/transação, não só durante o parser.
      req.liberarMidia = liberar;
      res.once("finish", liberar);
      res.once("close", () => { if (!req.processandoMidia) liberar(); });
      receber(req, res, (falha) => {
        if (falha) {
          delete req.file;
          return res.status(422).json({ erro: "Envie um único arquivo JPEG, PNG, MP4 ou WebM de até 5 MB e campos válidos." });
        }
        try {
          if (req.file) identificarArquivo(req.file);
          // Campos repetidos/estruturados não passam pela conversão silenciosa do validator.
          for (const valor of Object.values(req.body)) {
            if (typeof valor !== "string") return res.status(422).json({ erro: "Envie cada campo uma única vez, como texto." });
          }
          return next();
        } catch (erro) { return res.status(422).json({ erro: erro.message }); }
      });
    });
  };
}

module.exports = { criarReceberMidia, receberMidiaRelato: criarReceberMidia() };
