const multer = require("multer");
const pedidos = new Map();
const JANELA_MS = 60 * 60 * 1000;
const LIMITE_POR_HORA = 5;

const receber = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4, parts: 5, fieldSize: 2048 },
  fileFilter(req, arquivo, callback) {
    if (!["image/jpeg", "image/png"].includes(arquivo.mimetype)) {
      return callback(Object.assign(new Error("Tipo de imagem não permitido."), { previsto: true }));
    }
    return callback(null, true);
  },
}).single("foto");

function receberFotoPerfil(req, res, next) {
  res.set("Cache-Control", "no-store");
  const agora = Date.now();
  for (const [id, pedido] of pedidos) if (pedido.ate <= agora) pedidos.delete(id);
  const id = String(req.session.usuario.id);
  let pedido = pedidos.get(id);
  if (!pedido && pedidos.size < 5000) {
    pedido = { total: 0, ate: agora + JANELA_MS };
    pedidos.set(id, pedido);
  }
  if (!pedido || pedido.total >= LIMITE_POR_HORA) {
    const espera = Math.ceil(((pedido?.ate ?? agora + JANELA_MS) - agora) / 1000);
    res.set("Retry-After", String(espera));
    return res.status(429).render("pages/erro", {
      status: 429,
      titulo: "Aguarde antes de trocar a foto",
      mensagem: "Você atingiu o limite temporário de fotos. Tente novamente mais tarde.",
    });
  }
  pedido.total++;
  receber(req, res, erro => {
    if (erro) {
      return res.status(422).render("pages/erro", {
        status: 422,
        titulo: "Foto não enviada",
        mensagem: "Envie uma única imagem JPEG ou PNG de até 5 MB.",
      });
    }
    return next();
  });
}

module.exports = { receberFotoPerfil };
