const { randomUUID } = require("node:crypto");
const poolPadrao = require("../config/db");
const { conferirRegistro } = require("../helpers/midiaRelato");

function erroDeRelato(mensagem, status, campo) {
  return Object.assign(new Error(mensagem), { status, campo });
}

function criarRelatoModel(pool = poolPadrao) {
  // Recebe dados ja validados pelo controller. usuarioId vem da sessao,
  // gravidade vem do campo "severidade" e categoriaSlug vem de "categoria".
  async function criarRelato({
    usuarioId, categoriaSlug, bairroId, titulo, descricao,
    gravidade, latitude, longitude, referencia, midia,
  }) {
    if (midia && !conferirRegistro(midia)) throw erroDeRelato("Anexo inválido.", 422, "midia");
    // Nao inventa coordenadas quando o formulario nao fornece uma localizacao.
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw erroDeRelato("Informe uma localização válida para o relato.", 422, "localizacao");
    }

    const conexao = await pool.getConnection();
    let commitSolicitado = false;
    try {
      await conexao.beginTransaction();

      const [usuarios] = await conexao.query(
        `SELECT id FROM usuarios
          WHERE id = ? AND status = 'ativo' AND deleted_at IS NULL
            AND email_verificado_em IS NOT NULL FOR UPDATE`,
        [usuarioId]
      );
      if (!usuarios.length) {
        throw erroDeRelato("Entre com uma conta ativa e verificada para relatar.", 403, "usuario");
      }

      const [categorias] = await conexao.query(
        "SELECT id FROM categorias_ocorrencia WHERE slug = ? AND ativo = 1 LIMIT 1",
        [categoriaSlug]
      );
      if (!categorias.length) {
        throw erroDeRelato("Selecione uma categoria ativa e válida.", 422, "categoria");
      }

      const [bairros] = await conexao.query(
        `SELECT b.id, b.cidade_id FROM bairros b
           JOIN cidades c ON c.id = b.cidade_id
          WHERE b.id = ? AND b.ativo = 1 AND c.ativo = 1 LIMIT 1`,
        [bairroId]
      );
      if (!bairros.length) {
        throw erroDeRelato("Selecione um bairro ativo e válido.", 422, "bairro");
      }

      const publicId = randomUUID();
      const [insercao] = await conexao.query(
        `INSERT INTO relatos
           (public_id, usuario_id, categoria_id, cidade_id, bairro_id,
            titulo, descricao, gravidade, status, latitude, longitude, endereco_referencia)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?, ?)`,
        [publicId, usuarioId, categorias[0].id, bairros[0].cidade_id, bairros[0].id,
          titulo, descricao, gravidade, latitude, longitude, referencia || null]
      );

      // A criacao e o primeiro registro do historico: ambos persistem ou nenhum.
      await conexao.query(
        `INSERT INTO historico_status_relato
           (relato_id, status_anterior, status_novo, alterado_por_usuario_id, observacao)
         VALUES (?, NULL, 'aberto', ?, 'Criação do relato')`,
        [insercao.insertId, usuarioId]
      );

      if (midia) {
        await conexao.query(`INSERT INTO relato_midias
          (relato_id, tipo, chave_arquivo, mime_type, tamanho_bytes, ordem) VALUES (?, ?, ?, ?, ?, 0)`,
          [insercao.insertId, midia.tipo, midia.chave_arquivo, midia.mime_type, midia.tamanho_bytes]);
      }
      commitSolicitado = true;
      await conexao.commit();
      // Nao cria aprovacao em moderacoes_relato: ainda nao aparece publicamente.
      return { publicId, status: "aberto" };
    } catch (erro) {
      // Falha de conexão durante COMMIT não prova que nada foi gravado.
      // Nesse caso não apagar o arquivo remoto: pode haver um relato confirmado.
      if (commitSolicitado) erro.persistenciaIncerta = true;
      try { await conexao.rollback(); }
      catch { erro.persistenciaIncerta = true; }
      throw erro;
    } finally {
      conexao.release();
    }
  }

  return { criarRelato };
}

module.exports = { ...criarRelatoModel(), criarRelatoModel };
