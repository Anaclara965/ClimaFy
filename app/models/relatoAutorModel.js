const poolPadrao = require("../config/db");
const { MAX_VERSAO } = require("../helpers/versaoRelato");
function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status, previsto: true }); }

function criarRelatoAutorModel(pool = poolPadrao) {
  async function comRelato({ publicId, usuarioId }, operacao) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const [usuarios] = await conexao.query(`SELECT id FROM usuarios WHERE id = ? AND status = 'ativo'
        AND email_verificado_em IS NOT NULL AND deleted_at IS NULL FOR UPDATE`, [usuarioId]);
      if (!usuarios.length) throw erro("Entre com uma conta ativa e verificada.", 403);
      // Autoria no SQL, não em campos que o cliente pode escolher.
      const [linhas] = await conexao.query(`SELECT id, versao_conteudo, deleted_at, status,
        titulo, descricao, gravidade, categoria_id, bairro_id, cidade_id,
        latitude, longitude, endereco_referencia FROM relatos
        WHERE public_id = ? AND usuario_id = ? FOR UPDATE`, [publicId, usuarioId]);
      if (!linhas.length) throw erro("Relato não encontrado.", 404);
      const resultado = await operacao(conexao, linhas[0]);
      await conexao.commit();
      return resultado;
    } catch (falha) { await conexao.rollback(); throw falha; }
    finally { conexao.release(); }
  }

  function conferirVersao(relato, versao) {
    if (String(relato.versao_conteudo) !== versao) {
      throw erro("O relato mudou. Atualize a página antes de continuar; seus dados não foram sobrescritos.", 409);
    }
  }

  async function editar(dados) {
    if (!Number.isFinite(dados.latitude) || dados.latitude < -90 || dados.latitude > 90 ||
        !Number.isFinite(dados.longitude) || dados.longitude < -180 || dados.longitude > 180) {
      throw erro("Informe uma localização válida.", 422);
    }
    return comRelato(dados, async (conexao, relato) => {
      if (relato.deleted_at) throw erro("Relato não encontrado.", 404);
      conferirVersao(relato, dados.versao);
      const [categorias] = await conexao.query(
        "SELECT id FROM categorias_ocorrencia WHERE slug = ? AND ativo = 1 LIMIT 1", [dados.categoriaSlug]
      );
      if (!categorias.length) throw erro("Selecione uma categoria ativa e válida.", 422);
      const [bairros] = await conexao.query(`SELECT b.id, b.cidade_id FROM bairros b
        JOIN cidades c ON c.id = b.cidade_id WHERE b.id = ? AND b.ativo = 1 AND c.ativo = 1 LIMIT 1`, [dados.bairroId]);
      if (!bairros.length) throw erro("Selecione um bairro ativo e válido.", 422);
      const novos = { titulo: dados.titulo, descricao: dados.descricao, gravidade: dados.gravidade,
        categoria_id: categorias[0].id, bairro_id: bairros[0].id, cidade_id: bairros[0].cidade_id,
        latitude: dados.latitude, longitude: dados.longitude, endereco_referencia: dados.referencia || null };
      const numericos = ["categoria_id", "bairro_id", "cidade_id", "latitude", "longitude"];
      const mudou = Object.entries(novos).some(([campo, valor]) => numericos.includes(campo)
        ? Number(relato[campo]) !== Number(valor) : relato[campo] !== valor);
      if (!mudou) {
        const [publicados] = await conexao.query("SELECT id FROM vw_relatos_publicos WHERE id = ?", [relato.id]);
        return { publicId: dados.publicId, versao: dados.versao, status: relato.status,
          alterado: false, publicado: publicados.length > 0 };
      }
      if (Number(relato.versao_conteudo) >= MAX_VERSAO) throw erro("Limite de versões atingido. Contate a equipe.", 409);
      const anterior = Object.fromEntries(Object.keys(novos).map(campo => [campo, relato[campo]]));
      await conexao.query(`INSERT INTO relato_revisoes
        (relato_id, versao_conteudo, conteudo, editado_por_usuario_id) VALUES (?, ?, ?, ?)`,
        [relato.id, relato.versao_conteudo, JSON.stringify(anterior), dados.usuarioId]);
      const [atualizacao] = await conexao.query(`UPDATE relatos SET titulo = ?, descricao = ?, gravidade = ?,
        categoria_id = ?, bairro_id = ?, cidade_id = ?, latitude = ?, longitude = ?, endereco_referencia = ?,
        versao_conteudo = versao_conteudo + 1
        WHERE id = ? AND usuario_id = ? AND versao_conteudo = ? AND deleted_at IS NULL`,
        [...Object.values(novos), relato.id, dados.usuarioId, dados.versao]);
      if (atualizacao.affectedRows !== 1) throw erro("O relato mudou. Atualize a página.", 409);
      // A aprovação anterior permanece no histórico e não vale para a nova versão.
      // Situação, votos, mídias e histórico de moderação não são apagados.
      return { publicId: dados.publicId, versao: String(Number(relato.versao_conteudo) + 1),
        status: relato.status, alterado: true, publicado: false };
    });
  }

  async function excluir(dados) {
    return comRelato(dados, async (conexao, relato) => {
      if (!relato.deleted_at) {
        conferirVersao(relato, dados.versao);
        const [resultado] = await conexao.query(`UPDATE relatos SET deleted_at = UTC_TIMESTAMP()
          WHERE id = ? AND usuario_id = ? AND versao_conteudo = ? AND deleted_at IS NULL`,
          [relato.id, dados.usuarioId, dados.versao]);
        if (resultado.affectedRows !== 1) throw erro("O relato mudou. Atualize a página.", 409);
      }
      // Repetir exclusão própria é seguro; nenhuma linha é apagada fisicamente.
      return { publicId: dados.publicId, excluido: true };
    });
  }
  return { editar, excluir };
}
module.exports = { ...criarRelatoAutorModel(), criarRelatoAutorModel };
