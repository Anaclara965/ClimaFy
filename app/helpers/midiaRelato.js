const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = Object.freeze({
  "image/jpeg": { tipo: "foto", formato: "jpg", recurso: "image" },
  "image/png": { tipo: "foto", formato: "png", recurso: "image" },
  "video/mp4": { tipo: "video", formato: "mp4", recurso: "video" },
  "video/webm": { tipo: "video", formato: "webm", recurso: "video" },
});
const CHAVE = /^climafy\/relatos\/[a-f0-9-]{36}$/;
function erroMidia(mensagem, status = 422) {
  return Object.assign(new Error(mensagem), { status, previsto: true });
}

// Triagem de assinatura, não um antivírus/decoder. O Cloudinary também precisa
// decodificar o arquivo e confirmar formato, dimensões e (para vídeo) duração.
function identificarArquivo(arquivo) {
  const b = arquivo?.buffer;
  if (!Buffer.isBuffer(b) || !b.length || b.length > MAX_BYTES) {
    throw erroMidia("Envie um arquivo não vazio de até 5 MB.");
  }
  let mime;
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
      b.toString("ascii", 12, 16) === "IHDR") mime = "image/png";
  else if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255 &&
      b[b.length - 2] === 255 && b[b.length - 1] === 217) mime = "image/jpeg";
  else if (b.length >= 16 && b.toString("ascii", 4, 8) === "ftyp" &&
      /^(isom|iso[2-9]|mp41|mp42|avc1|dash|M4V )$/.test(b.toString("ascii", 8, 12))) mime = "video/mp4";
  else if (b.length >= 16 && b.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")) &&
      b.subarray(4, 4096).includes(Buffer.from("webm"))) mime = "video/webm";
  if (!mime || mime !== arquivo.mimetype) {
    throw erroMidia("Arquivo inválido. Envie uma foto JPEG/PNG ou um vídeo MP4/WebM compatível com seu conteúdo.");
  }
  return { mime, ...TIPOS[mime] };
}

function conferirRegistro(midia) {
  return midia && TIPOS[midia.mime_type]?.tipo === midia.tipo &&
    CHAVE.test(midia.chave_arquivo) && Number.isInteger(Number(midia.tamanho_bytes)) &&
    Number(midia.tamanho_bytes) > 0 && Number(midia.tamanho_bytes) <= MAX_BYTES;
}

module.exports = { MAX_BYTES, TIPOS, CHAVE, erroMidia, identificarArquivo, conferirRegistro };
