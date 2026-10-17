const { randomUUID } = require("node:crypto");
const { MAX_BYTES, TIPOS, erroMidia, identificarArquivo, conferirRegistro } = require("../helpers/midiaRelato");

function criarMidiaService({ sdk, ambiente = process.env, buscar = globalThis.fetch, agora = Date.now,
  avisar = (mensagem) => console.warn(mensagem) } = {}) {
  function configuracao() {
    const cloud = ambiente.CLOUDINARY_CLOUD_NAME;
    const key = ambiente.CLOUDINARY_API_KEY;
    const secret = ambiente.CLOUDINARY_API_SECRET;
    if (typeof cloud !== "string" || !/^[a-zA-Z0-9_-]+$/.test(cloud) ||
        typeof key !== "string" || !key.trim() || typeof secret !== "string" || !secret.trim()) return null;
    return { cloud_name: cloud, api_key: key, api_secret: secret, secure: true, signature_algorithm: "sha256" };
  }
  function disponivel() { return Boolean(configuracao()); }
  function cliente() {
    const config = configuracao();
    if (!config) throw erroMidia("O envio de anexos ainda não está configurado. Envie sem arquivo por enquanto.", 503);
    // Config por chamada: não altera o singleton/configuração global do SDK.
    return { api: sdk ?? require("cloudinary").v2, config };
  }

  async function remover(midia) {
    if (!conferirRegistro(midia)) throw erroMidia("Referência de anexo inválida.");
    const { api, config } = cliente();
    const resultado = await api.uploader.destroy(midia.chave_arquivo, {
      ...config, resource_type: TIPOS[midia.mime_type].recurso, type: "authenticated", invalidate: true, timeout: 30000,
    });
    if (!["ok", "not found"].includes(resultado?.result)) throw erroMidia("Não foi possível limpar o anexo.", 502);
  }

  async function salvar(arquivo) {
    const identificado = identificarArquivo(arquivo);
    const { api, config } = cliente();
    const chave = "climafy/relatos/" + randomUUID();
    // Nunca aproveita nome, URL, public_id, pasta ou assinatura enviados pelo cliente.
    const opcoes = { ...config, public_id: chave, type: "authenticated", resource_type: identificado.recurso,
      allowed_formats: [identificado.formato], overwrite: false, use_filename: false,
      unique_filename: false, timeout: 30000 };
    if (identificado.tipo === "foto") opcoes.transformation = [{ flags: "strip_profile" }];
    let resultado;
    try {
      resultado = await new Promise((resolve, reject) => {
        const fluxo = api.uploader.upload_stream(opcoes, (falha, resposta) => falha ? reject(falha) : resolve(resposta));
        fluxo.on("error", reject);
        fluxo.end(arquivo.buffer);
      });
    } catch {
      // O provedor pode ter recebido o arquivo antes da conexão falhar. Não há
      // transação distribuída: manter privado e registrar chave para reconciliação.
      avisar(`[midia] Upload não confirmado; conferir objeto privado ${chave}.`);
      throw erroMidia("Não foi possível confirmar o anexo. Nenhum relato foi criado por este pedido.", 502);
    }
    const midia = { tipo: identificado.tipo, chave_arquivo: chave,
      mime_type: identificado.mime, tamanho_bytes: resultado?.bytes };
    if (resultado?.public_id !== chave || resultado?.type !== "authenticated" ||
        resultado?.resource_type !== identificado.recurso || resultado?.format !== identificado.formato ||
        !conferirRegistro(midia) || !Number.isFinite(resultado?.width) || !Number.isFinite(resultado?.height) ||
        resultado.width < 1 || resultado.height < 1 || resultado.width * resultado.height > 40000000 ||
        (identificado.tipo === "video" && (!Number.isFinite(resultado.duration) || resultado.duration <= 0 || resultado.duration > 30))) {
      // A chave é gerada por nós. Mesmo com resposta inesperada, a limpeza nunca
      // usa um public_id retornado arbitrariamente pelo serviço.
      try { await remover({ ...midia, tamanho_bytes: arquivo.buffer.length }); }
      catch { avisar(`[midia] Limpeza pendente do objeto privado ${chave}.`); }
      throw erroMidia("Anexo recusado após processamento. Use uma imagem válida ou um vídeo de até 30 segundos e 5 MB.");
    }
    return midia;
  }

  async function ler(midia) {
    if (!conferirRegistro(midia)) throw erroMidia("Anexo indisponível.", 404);
    const { api, config } = cliente();
    const tipo = TIPOS[midia.mime_type];
    const url = api.utils.private_download_url(midia.chave_arquivo, tipo.formato, {
      ...config, type: "authenticated", resource_type: tipo.recurso,
      expires_at: Math.floor(agora() / 1000) + 60, attachment: false,
    });
    const destino = new URL(url);
    if (destino.protocol !== "https:" || destino.hostname !== "api.cloudinary.com" || destino.username || destino.password) {
      throw erroMidia("Anexo indisponível.", 502);
    }
    try {
      // Não repassar a URL assinada ao navegador, logs ou redirects.
      const resposta = await buscar(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
      if (!resposta.ok || !resposta.body) throw new Error("Download recusado");
      const leitor = resposta.body.getReader();
      const partes = [];
      let total = 0;
      try {
        while (true) {
          const { value, done } = await leitor.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_BYTES) throw new Error("Download excedeu o limite");
          partes.push(Buffer.from(value));
        }
      } finally { await leitor.cancel().catch(() => {}); }
      if (total !== Number(midia.tamanho_bytes)) throw new Error("Tamanho divergente");
      return Buffer.concat(partes, total);
    } catch { throw erroMidia("Não foi possível carregar o anexo agora.", 502); }
  }
  return { disponivel, salvar, remover, ler };
}

module.exports = { ...criarMidiaService(), criarMidiaService };
