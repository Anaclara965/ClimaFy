const model = require("../models/midiaModel");
const service = require("../services/midiaService");
const { tokenRelatos } = require("../middlewares/csrfRelatos");
const { MAX_BYTES, TIPOS, conferirRegistro } = require("../helpers/midiaRelato");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let leiturasAtivas = 0;

function configuracao(req, res) {
  res.set("Cache-Control", "no-store");
  return res.json({ csrfToken: tokenRelatos(req), anexos: { disponivel: service.disponivel(),
    campo: "foto", quantidade: 1, tamanhoMaximoBytes: MAX_BYTES, duracaoMaximaVideoSegundos: 30,
    tipos: Object.keys(TIPOS), somenteNaCriacao: true } });
}

function consultar(modo) {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    const id = req.params.publicId;
    const midiaId = req.params.midiaId;
    if (!UUID.test(id) || (midiaId !== undefined && !/^[1-9][0-9]{0,19}$/.test(midiaId))) {
      return res.status(404).json({ erro: "Anexo não encontrado." });
    }
    let lendo = false;
    try {
      const acesso = modo === "publico" ? {} : modo === "moderador"
        ? { moderador: true } : { autorId: req.session.usuario.id };
      const midias = await model.listar(id, acesso);
      if (!midias) return res.status(404).json({ erro: "Relato não encontrado." });
      if (midiaId === undefined) {
        const base = modo === "publico" ? "/api/relatos/" : modo === "moderador" ? "/api/adm/relatos/" : "/api/meus-relatos/";
        return res.json({ midias: midias.filter(conferirRegistro).map(m => ({
          id: String(m.id), tipo: m.tipo, mimeType: m.mime_type, tamanhoBytes: Number(m.tamanho_bytes),
          url: base + id + "/midias/" + String(m.id),
        })) });
      }
      const midia = midias.find(m => String(m.id) === midiaId);
      if (!conferirRegistro(midia)) return res.status(404).json({ erro: "Anexo não encontrado." });
      if (leiturasAtivas >= 4) {
        res.set("Retry-After", "5");
        return res.status(429).json({ erro: "Muitos anexos em carregamento. Tente novamente." });
      }
      leiturasAtivas++; lendo = true;
      const conteudo = await service.ler(midia);
      // Range único para reprodução/seek. Não repassa Range arbitrário ao provedor.
      let inicio = 0; let fim = conteudo.length - 1;
      const range = req.get("Range");
      if (range) {
        const partes = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!partes || (!partes[1] && !partes[2])) {
          res.set("Content-Range", `bytes */${conteudo.length}`);
          return res.status(416).end();
        }
        inicio = partes[1] ? Number(partes[1]) : Math.max(0, conteudo.length - Number(partes[2]));
        fim = partes[1] && partes[2] ? Math.min(Number(partes[2]), fim) : fim;
        if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim) || inicio > fim || inicio < 0 || inicio >= conteudo.length) {
          res.set("Content-Range", `bytes */${conteudo.length}`);
          return res.status(416).end();
        }
        res.status(206); res.set("Content-Range", `bytes ${inicio}-${fim}/${conteudo.length}`);
      }
      res.set("Accept-Ranges", "bytes");
      res.set("Content-Type", midia.mime_type);
      res.set("Content-Disposition", `inline; filename="anexo.${TIPOS[midia.mime_type].formato}"`);
      return res.send(conteudo.subarray(inicio, fim + 1));
    } catch (falha) {
      if (falha.previsto) return res.status(falha.status).json({ erro: falha.message });
      return next(falha);
    } finally { if (lendo) leiturasAtivas--; }
  };
}

module.exports = { configuracao, listarPublico: consultar("publico"), listarMeu: consultar("autor"),
  listarModeracao: consultar("moderador") };
