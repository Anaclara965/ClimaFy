const poolPadrao = require("../config/db");

const ultimaModeracao = `LEFT JOIN moderacoes_relato m ON m.id = (
  SELECT mm.id FROM moderacoes_relato mm WHERE mm.relato_id = r.id AND mm.versao_conteudo = r.versao_conteudo
  ORDER BY mm.created_at DESC, mm.id DESC LIMIT 1)`;
const campos = `r.public_id, r.versao_conteudo, r.titulo, r.descricao, r.gravidade, r.status,
  r.latitude, r.longitude, r.endereco_referencia, r.created_at,
  b.nome AS bairro, b.id AS bairro_id, c.nome AS cidade,
  cat.nome AS categoria, cat.slug AS categoria_slug,
  (SELECT COUNT(*) FROM relato_votos v WHERE v.relato_id = r.id) AS votos`;
const joins = `JOIN bairros b ON b.id = r.bairro_id
  JOIN cidades c ON c.id = r.cidade_id
  JOIN categorias_ocorrencia cat ON cat.id = r.categoria_id`;

function apresentar(r) {
  return {
    publicId: r.public_id, versao: String(r.versao_conteudo ?? 1), titulo: r.titulo, descricao: r.descricao,
    severidade: r.gravidade, status: r.status,
    latitude: Number(r.latitude), longitude: Number(r.longitude),
    referencia: r.endereco_referencia, criadoEm: r.created_at,
    bairro: r.bairro, bairroId: r.bairro_id, cidade: r.cidade,
    categoria: r.categoria, categoriaSlug: r.categoria_slug, votos: Number(r.votos),
    ...(r.decisao !== undefined ? {
      moderacao: r.decisao || "pendente", revisao: String(r.revisao || 0),
      motivo: r.motivo || null, observacao: r.observacao || null,
    } : {}),
    ...(r.autor !== undefined ? { autor: r.autor } : {}),
  };
}

function criarRelatoConsultaModel(pool = poolPadrao) {
  async function listar({ pagina = 1, limite = 12, busca = "", status, categoria, bairro,
    dias, ordem = "recent", autorId } = {}) {
    const privado = autorId !== undefined;
    const fonte = privado ? "relatos" : "vw_relatos_publicos";
    const condicoes = ["r.deleted_at IS NULL"].filter(() => privado);
    const parametros = [];
    if (privado) { condicoes.push("r.usuario_id = ?"); parametros.push(autorId); }
    if (busca) {
      // LIKE parametrizado: caracteres especiais nao alteram a estrutura SQL.
      const termo = `%${busca.replace(/[!%_]/g, "!$&")}%`;
      condicoes.push("(r.titulo LIKE ? ESCAPE '!' OR r.descricao LIKE ? ESCAPE '!' OR b.nome LIKE ? ESCAPE '!')");
      parametros.push(termo, termo, termo);
    }
    if (status) { condicoes.push("r.status = ?"); parametros.push(status); }
    if (categoria) { condicoes.push("cat.slug = ?"); parametros.push(categoria); }
    if (bairro) { condicoes.push("r.bairro_id = ?"); parametros.push(bairro); }
    if (dias) { condicoes.push("r.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)"); parametros.push(dias); }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
    const ordenacao = { recent: "r.created_at DESC, r.id DESC", oldest: "r.created_at ASC, r.id ASC",
      votes: "votos DESC, r.created_at DESC, r.id DESC" }[ordem];
    const base = `FROM ${fonte} r ${joins} ${privado ? ultimaModeracao : ""} ${where}`;
    const [linhas] = await pool.query(`SELECT ${campos} ${privado ? ", m.decisao, m.id AS revisao, m.observacao, mot.titulo AS motivo" : ""}
      FROM ${fonte} r ${joins} ${privado ? `${ultimaModeracao} LEFT JOIN motivos_moderacao mot ON mot.id = m.motivo_id` : ""}
      ${where} ORDER BY ${ordenacao} LIMIT ? OFFSET ?`, [...parametros, limite, (pagina - 1) * limite]);
    const [[contagem]] = await pool.query(`SELECT COUNT(*) AS total ${base}`, parametros);
    const total = Number(contagem.total);
    const resultado = { relatos: linhas.map(apresentar), paginacao: { pagina, limite, total, paginas: Math.ceil(total / limite) } };
    if (privado) return resultado;
    // Todos os numeros publicos usam a mesma regra de publicacao da view.
    const [[resumo]] = await pool.query(`SELECT COUNT(*) AS total,
      COALESCE(SUM(status = 'aberto'), 0) AS abertos,
      COALESCE(SUM(status = 'em_andamento'), 0) AS emAndamento,
      COALESCE(SUM(status = 'resolvido'), 0) AS resolvidos,
      COUNT(DISTINCT bairro_id) AS bairros FROM vw_relatos_publicos`);
    const [categorias] = await pool.query(`SELECT DISTINCT cat.slug, cat.nome
      FROM vw_relatos_publicos r JOIN categorias_ocorrencia cat ON cat.id = r.categoria_id ORDER BY cat.nome`);
    const [bairros] = await pool.query(`SELECT DISTINCT b.id, b.nome FROM vw_relatos_publicos r
      JOIN bairros b ON b.id = r.bairro_id ORDER BY b.nome`);
    // Alimenta os blocos que ja existiam na tela, sem dados de demonstracao.
    // Destaques e concentracao consideram todos os publicados, nao so a pagina.
    const [destaques] = await pool.query(`SELECT ${campos} FROM vw_relatos_publicos r ${joins}
      ORDER BY votos DESC, r.created_at DESC, r.id DESC LIMIT 2`);
    const [porBairro] = await pool.query(`SELECT b.id, b.nome, COUNT(*) AS total
      FROM vw_relatos_publicos r JOIN bairros b ON b.id = r.bairro_id
      WHERE r.status = 'aberto' GROUP BY b.id, b.nome ORDER BY total DESC, b.nome ASC LIMIT 8`);
    return { ...resultado, resumo: Object.fromEntries(Object.entries(resumo).map(([chave, valor]) => [chave, Number(valor)])),
      filtros: { categorias, bairros }, destaques: destaques.map(apresentar),
      porBairro: porBairro.map(b => ({ id: b.id, nome: b.nome, total: Number(b.total) })) };
  }

  async function buscarPublico(publicId) {
    const [linhas] = await pool.query(`SELECT ${campos} FROM vw_relatos_publicos r ${joins}
      WHERE r.public_id = ? LIMIT 1`, [publicId]);
    return linhas[0] ? apresentar(linhas[0]) : null;
  }

  async function buscarPrivado(publicId, { autorId, moderador = false }) {
    const [linhas] = await pool.query(`SELECT ${campos}, m.decisao, m.id AS revisao,
      m.observacao, mot.titulo AS motivo, u.nome AS autor FROM relatos r ${joins}
      JOIN usuarios u ON u.id = r.usuario_id ${ultimaModeracao}
      LEFT JOIN motivos_moderacao mot ON mot.id = m.motivo_id
      WHERE r.public_id = ? AND r.deleted_at IS NULL ${moderador ? "" : "AND r.usuario_id = ?"} LIMIT 1`,
      moderador ? [publicId] : [publicId, autorId]);
    return linhas[0] ? apresentar(linhas[0]) : null;
  }
  return { listar, buscarPublico, buscarPrivado };
}

module.exports = { ...criarRelatoConsultaModel(), criarRelatoConsultaModel, apresentar, ultimaModeracao, campos, joins };
