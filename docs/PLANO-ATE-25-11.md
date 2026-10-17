# Plano do ClimaFy até 25/11/2026

**Hoje:** 26/09/2026 · **Entrega:** 25/11/2026 · **Fôlego:** 8 semanas de sprint + 3 dias de congelamento.

Regra do projeto (README, "Sobre este documento"): **código e documentação mudam na mesma PR**.
Se o código divergir do README, o código está errado.

---

## 1. Como este plano funciona

- **Sprint = 1 semana.** Cada objetivo tem dono (frente) e "pronto quando".
- **"Pronto quando" é verificável:** a frase precisa poder ser testada clicando na tela (`npm start`) ou rodando `npm test`.
- **Branch por objetivo:** `feat/relatos-crud`, `feat/moderacao-real`, etc. Integração por PR toda sexta.
- **Nada de trabalho direto em `main`.** PR precisa: `npm test` verde + tela funcionando + README atualizado se o contrato mudou.
- **Antes de cada PR:**
  ```bash
  npm test          # 22 testes hoje, todos offline (não precisam de banco)
  npm start         # e clicar no fluxo afetado
  ```

### Definição de pronto (vale para todo objetivo)

1. Funciona de ponta a ponta (tela → rota → controller → model → banco) **sem mock**.
2. Respeita o contrato da seção 6 do README (sucesso só depois do 2xx; API erra com `{ erro }`/`{ erros: [] }`; página re-renderiza).
3. Tem teste em `tests/` quando a regra é de negócio (validação, permissão, cálculo).
4. Está no README (6.2 para endpoint novo; seção 10 quando muda o estado do projeto).

---

## 2. Linha de objetivos

Ordem pensada para destravar o que é pré-requisito do resto.

| # | Objetivo | Sprint | Dono | Pronto quando |
|---|---|---|---|---|
| **O1** | **Login e sessão reais** (base de tudo) | S1 | Backend | ✅ **feito** — visitante em `/adm` vai para `/login?proximo=/adm`; usuário verificado entra e vê o nome no header |
| **O2** | **Criar usuário no banco com código de e-mail** | S1 | Backend | ✅ **feito** — cadastro cria conta (`bcryptjs`), envia código; `/cadastro-verificacao` confere no servidor |
| **O3** | **Relato persistido** (tirar o mock do `/new-report`) | S2–S3 | Backend + Front | Envio **autenticado** grava em `relatos` com `bairro_id`, categoria, lat/long e ponto de referência; autor vê "meus relatos" com situação `aberto` |
| **O4** | **Mapa público com Leaflet** (pinos por categoria) | S3–S4 | Front | `/relatos` (ou `/mapa`) renderiza pinos de `vw_relatos_publicos`, coloridos por `categorias_ocorrencia.cor`, com filtro de categoria e período (7/30/90 dias) |
| **O5** | **Moderação real** | S4–S5 | Backend | `/adm/moderacao` lista pendentes do banco; aprovar/negar grava em `moderacoes_relato` (`motivo_id` + observação) e o relato aparece/some do mapa; decisão gera linha em `logs_auditoria` |
| **O6** | **Painel administrativo com números do banco** | S5 | Backend | `/adm` e `/adm/usuarios` mostram contadores por SQL (total, pendentes, aprovados, cidades, bairros) e a lista de usuários com papel/status |
| **O7** | **Gerenciamento de perfil** | S6 | Backend + Front | `/perfil` edita nome/sobrenome, troca senha (exigindo a atual) e revisa preferências; persiste após recarregar |
| **O8** | **Recuperar senha por e-mail** | S6 | Backend | `/esqueci-senha` cria código com `finalidade='recuperacao_senha'`; `/redefinir-senha` valida (expiração + tentativas) e troca o hash; a senha antiga para de funcionar |
| **O9** | **Foto no relato (multer)** | S7 | Backend + Front | Upload PNG/JPEG até 5 MB grava em `relato_midias` (`chave_arquivo`, `mime_type`, `tamanho_bytes`) e aparece no detalhe; tipo/tamanho inválidos → 422 |
| **O10** | **Notificações e integrações** | S7–S8 | Backend | Notificação in-app em `notificacoes` quando o relato é moderado; `preferencias_notificacao` respeitada; `ocorrencias_oficiais` populada a partir de `DADOS/*.csv` via `/adm` (com `lotes_importacao`) |
| **O11** | **Deploy + demo** | S8 + congelamento | Todos | Render + MySQL gerenciado, `SESSION_SECRET` configurado, geografia carregada, ≥ 30 relatos de demonstração, 2 notebooks com versão local pronta (§6) |
| **O12** | **Documentação, manual e slides** | S2–S8 (contínuo) | Negócios | `docs/MANUAL.md` e `docs/DECISOES.md` + slides com demo roteirizada; README seção 10 atualizada a cada sprint |

### Caminho crítico

`O3 (relato)` → `O4 (mapa)` → `O5 (moderação)` → `O6 (painel)`.
Se a semana atrasar, corte **O9 (foto)** e **O10 (importação de CSV)**: são os últimos da fila e não bloqueiam a banca.

---

## 3. Requisitos das aulas ↔ onde cada um aparece no projeto

Os PDFs de apoio (PSW2/PSW3) formam um checklist técnico. Use esta tabela como roteiro de
conferência antes da apresentação:

| Tema do material | Onde está no ClimaFy | Status |
|---|---|---|
| Cliente-servidor Express / projeto com Node | `app.js`, `app/routes/` | ✅ |
| EJS (views + partials) | `app/views/pages/*.ejs`, `partials/header`, `partials/footer` | ✅ |
| Envio de dados via POST | `POST /cadastro-dados-pessoais`, `/login`, `/api/*` | ✅ |
| Validação de dados | `app/helpers/validacoesCadastro.js` + `express-validator` | ✅ |
| Validação personalizada | `.custom()` de senha/confirmação; `senhaValida()` | ✅ |
| MVC | `routes` → `controllers` → `models` (SQL só em `models`) | ✅ |
| Variáveis de sessão | `express-session` (`req.session.usuario`, `cadastroPendente`) | ✅ |
| Autenticação e autorização | `app/middlewares/exigirAutenticacao.js` (`exigirPapel`) | ✅ |
| Integração com o SGBD (MySQL) | `app/config/db.js` (pool) + models com `mysql2` | ✅ |
| Ativar conta | cadastro → código de 6 dígitos → `email_verificado_em` | ✅ |
| Envio de e-mail | `app/services/emailService.js` (nodemailer + modo dev) | ✅ |
| Recuperar senha | `codigos_verificacao_email.finalidade='recuperacao_senha'` | ⏳ O8 |
| Gerenciamento de perfil | `/perfil` (nome, senha, preferências) | ⏳ O7 |
| Multer, Path e Fs | upload de foto (`relato_midias`) | ⏳ O9 |
| Consumindo APIs | `fetch('/api/bairros')` no autocomplete; Leaflet + tiles; futuramente INMET/CEMADEN | ✅ / ⏳ O10 |
| Notificações com simple-notify | CDN no cadastro/verificação/preferências, com fallback textual | ✅ parcial |
| JWT | reservado para API pública sem cookie (README 5.1) | ⏳ opcional |
| Análise orientada a objetos | entidades do schema (Usuario, Relato, Moderacao, Bairro) | ✅ (documentar no TCC) |
| Tratamento de erros | `app/helpers/errosValidacao.js` + handler global em `app.js` | ✅ |
| Deploy | Render + MySQL; `NODE_ENV=production` ativa `trust proxy` e cookie `secure` | ⏳ O11 |

---

## 4. Cronograma

| Sprint | Semana | Foco | Entrega no fim da semana |
|---|---|---|---|
| S1 | 28/09 – 04/10 | Auth (concluir O1/O2 no banco real) | Cadastro + verificação + login funcionando com o banco; `npm run criar-usuario` cria o admin |
| S2 | 05/10 – 11/10 | Relato (backend) | `POST /api/relatos` + `/relatos/meus`; teste de criação |
| S3 | 12/10 – 18/10 | Relato (front) + mapa | Formulário envia de verdade; Leaflet renderiza pinos de `vw_relatos_publicos` |
| S4 | 19/10 – 25/10 | Filtros + moderação (início) | Filtro categoria/período; `/adm/moderacao` lista pendentes reais |
| S5 | 26/10 – 01/11 | Moderação + painel | Aprovar/negar grava `moderacoes_relato`; `/adm` com contadores do banco |
| S6 | 02/11 – 08/11 | Perfil + recuperar senha | O7 e O8 prontos |
| S7 | 09/11 – 15/11 | Upload + notificações | O9; notificação in-app ao autor na moderação |
| S8 | 16/11 – 22/11 | Integrações + deploy | O10 (importação de CSV) e O11 em produção |
| Congelamento | 23/11 – 25/11 | Nada de feature nova | Dados de demonstração, ensaio da demo, 2 notebooks prontos |

---

## 5. Receitas de código (o essencial de cada objetivo)

Estas receitas seguem exatamente o padrão já existente no projeto: **SQL só no model**, controller
coordena, rota encadeia middlewares, view/JS consomem o contrato. Cada model aceita `pool` por
parâmetro (`criarXModel(pool)`) para o teste rodar sem banco — copie o padrão de
`tests/support/fakePool.js`.

### 5.1 O3 — Relato persistido

**`app/models/relatoModel.js`** (esqueleto):

```js
const poolPadrao = require("../config/db");

function criarRelatoModel(pool = poolPadrao) {
  async function criar({ usuarioId, categoriaId, bairroId, titulo, descricao, severidade, latitude, longitude, referencia }) {
    // cidade_id vem do bairro: nunca confie em cidade digitada pelo usuário.
    const [[bairro]] = await pool.query(
      "SELECT id, cidade_id FROM bairros WHERE id = ? AND ativo = 1",
      [bairroId]
    );
    if (!bairro) throw Object.assign(new Error("Bairro inválido."), { status: 422 });

    const [resultado] = await pool.query(
      `INSERT INTO relatos
         (usuario_id, categoria_id, cidade_id, bairro_id, titulo, descricao, severidade, latitude, longitude, endereco_referencia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, categoriaId, bairro.cidade_id, bairro.id, titulo, descricao, severidade, latitude, longitude, referencia]
    );

    // Toda mudança de situação entra no histórico (situação inicial: aberto).
    await pool.query(
      `INSERT INTO historico_status_relato (relato_id, status_anterior, status_novo, alterado_por_usuario_id, observacao)
       VALUES (?, NULL, 'aberto', ?, 'Criação do relato')`,
      [resultado.insertId, usuarioId]
    );

    return resultado.insertId;
  }

  async function listarDoUsuario(usuarioId) { /* SELECT ... WHERE usuario_id = ? ORDER BY created_at DESC */ }

  // Sempre pela view: ela já aplica a regra de publicação (README 7.2).
  async function listarPublicos({ categoriaId, dias } = {}) {
    const filtros = [];
    const valores = [];
    if (categoriaId) { filtros.push("r.categoria_id = ?"); valores.push(categoriaId); }
    if (dias) { filtros.push("r.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)"); valores.push(Number(dias)); }

    const [linhas] = await pool.query(
      `SELECT r.public_id, r.titulo, r.status, r.latitude, r.longitude, r.created_at,
              b.nome AS bairro, c.nome AS cidade, co.nome AS categoria, co.cor, co.slug
         FROM vw_relatos_publicos r
         JOIN bairros b ON b.id = r.bairro_id
         JOIN cidades c ON c.id = r.cidade_id
         JOIN categorias_ocorrencia co ON co.id = r.categoria_id
        ${filtros.length ? `WHERE ${filtros.join(" AND ")}` : ""}
        ORDER BY r.created_at DESC
        LIMIT 200`,
      valores
    );
    return linhas;
  }

  return { criar, listarDoUsuario, listarPublicos };
}

module.exports = { ...criarRelatoModel(), criarRelatoModel };
```

**Controller** (`app/controllers/relatoControllers.js`): valida com `express-validator`, chama o
model, responde `201 { ok, publicId }` na API ou `303 → /relatos/meus` no formulário. Para o
`usuarioId`, **sempre** `req.session.usuario.id` — nunca aceite `usuario_id` do `req.body`.

**Rotas** (`app/routes/router.js`):

```js
router.get("/relatos/meus", exigirAutenticacao, exigirEmailVerificado, mostrarMeusRelatos);
router.get("/api/relatos", listarRelatosPublicos);                 // público (usa a view)
router.post("/api/relatos", exigirAutenticacao, exigirEmailVerificado,
  [validarTitulo, validarDescricao, validarCategoria, validarBairro, validarSeveridade, validarCoordenadas],
  criarRelato);
```

### 5.2 O5 — Moderação de verdade

**`app/models/moderacaoModel.js`** — o núcleo são duas escritas na **mesma transação** mais a auditoria:

```js
async function decidir({ relatoId, moderadorId, decisao, motivoId, observacao }) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    await conexao.query(
      `INSERT INTO moderacoes_relato (relato_id, moderador_id, decisao, motivo_id, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [relatoId, moderadorId, decisao, motivoId ?? null, observacao ?? null]
    );
    await conexao.query(
      `INSERT INTO logs_auditoria (usuario_id, acao, entidade, entidade_id, depois_json)
       VALUES (?, 'moderacao', 'relatos', ?, ?)`,
      [moderadorId, relatoId, JSON.stringify({ decisao, motivoId: motivoId ?? null })]
    );
    await conexao.commit();
  } catch (erro) { await conexao.rollback(); throw erro; } finally { conexao.release(); }
}
```

Pontos que não podem ser esquecidos:
- **Não existe coluna "publicado".** A visibilidade é derivada da última decisão (`vw_relatos_publicos`)
  — aprovar faz o relato aparecer no mapa sem tocar em `relatos.status`.
- **Aprovar ≠ resolver.** Ao aprovar, deixe `relatos.status = 'aberto'`.
- **Rejeição exige `motivo_id`** (`motivos_moderacao` já tem 6 motivos no seed).

**Rotas** (`app/routes/router-adm.js`), seguindo o encadeamento já criado:

```js
router.post("/adm/moderacao/:publicId/aprovar", exigirPapel("moderador"), aprovarRelato);
router.post("/adm/moderacao/:publicId/negar", [validarMotivo, validarObservacao], negarRelato);
```

A view de moderação troca os botões mockados por `fetch`/`<form>` para essas rotas e recarrega a
lista do banco (`GET /adm/moderacao` passa a receber os pendentes do controller).

### 5.3 O6 — Painel administrativo com números reais

Os contadores são **consulta**, nunca coluna (regra do próprio schema). Um model só com agregações:

```sql
-- relatos por situação de moderação/situação
SELECT
  (SELECT COUNT(*) FROM relatos WHERE deleted_at IS NULL) AS total,
  (SELECT COUNT(*) FROM relatos r WHERE r.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM moderacoes_relato m WHERE m.relato_id = r.id)) AS aguardando,
  (SELECT COUNT(*) FROM vw_relatos_publicos) AS publicados,
  (SELECT COUNT(DISTINCT bairro_id) FROM relatos WHERE deleted_at IS NULL) AS bairros,
  (SELECT COUNT(DISTINCT cidade_id) FROM relatos WHERE deleted_at IS NULL) AS cidades,
  (SELECT COUNT(*) FROM usuarios WHERE deleted_at IS NULL) AS usuarios;
```

Categorias mais frequentes (para o gráfico do dashboard):

```sql
SELECT co.nome, co.cor, COUNT(*) AS total
  FROM vw_relatos_publicos r
  JOIN categorias_ocorrencia co ON co.id = r.categoria_id
 GROUP BY co.id
 ORDER BY total DESC;
```

### 5.4 O8 — Recuperar senha (reusa 90% do que já existe)

O schema já tem `finalidade='recuperacao_senha'`; o código de verificação também. Só faltam duas rotas:

```js
// 1) pedir o código: SEMPRE responde a mesma mensagem (não revela se o e-mail existe)
router.post("/api/esqueci-senha", [validarEmailLogin], async (req, res, next) => {
  const usuario = await usuarioModel.buscarPorEmail(req.body.email);
  if (usuario) {
    const codigo = gerarCodigo();
    await verificacaoModel.criarCodigo({
      usuarioId: usuario.id, codigoHash: hashCodigo(codigo),
      finalidade: "recuperacao_senha", expiraEm: calcularExpiracao(),
    });
    await emailService.enviarCodigoVerificacao(usuario.email, codigo, { finalidade: "recuperacao_senha" });
  }
  return res.status(200).json({ ok: true, mensagem: "Se o e-mail existir, enviamos um código." });
});

// 2) redefinir: confere código (expiração + tentativas), grava novo hash e derruba as sessões
router.post("/api/redefinir-senha", [validarEmailLogin, validarCodigo, validarSenha, validarConfirmacaoSenha], ...);
// depois de trocar: usuarioModel.atualizarSenha(usuario.id, await gerarHash(senha))
```

Dois cuidados: a tela de redefinir precisa do e-mail (passe por `?email=` ou sessão) e, ao trocar a
senha, o certo é exigir novo login (não emita sessão ali).

### 5.5 O7 — Gerenciamento de perfil

`app/controllers/perfilControllers.js` + `GET /perfil` (privado):

- Editar nome/sobrenome → `UPDATE usuarios SET nome = ?, sobrenome = ? WHERE id = ?` (id **da sessão**).
- Trocar senha → `conferirSenha(senhaAtual, usuario.senha_hash)` antes de `atualizarSenha()`; erro 422 se a atual não conferir.
- Reaproveitar as preferências já implementadas: `/perfil/preferencias` pode simplesmente renderizar a mesma view de preferências com o estado do banco.

### 5.6 O9 — Upload de foto com multer

```js
// app/config/upload.js
const path = require("node:path");
const multer = require("multer");

const PASTA = path.join(__dirname, "..", "public", "uploads");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PASTA),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB (mesmo limite do CHECK no schema)
  fileFilter: (req, file, cb) => {
    const aceitos = ["image/png", "image/jpeg"];
    cb(null, aceitos.includes(file.mimetype)); // recusa silenciosa; valide depois na rota
  },
});

module.exports = { upload, PASTA };
```

Na rota: `router.post("/api/relatos", upload.single("foto"), ...)` e, depois de gravar o relato,
insira a linha em `relato_midias` com `chave_arquivo` = `/uploads/<arquivo>`, `mime_type` e
`tamanho_bytes` (o schema tem `CHECK` de 5 MB e de mime). Crie `app/public/uploads/.gitkeep` e
adicione `app/public/uploads/*` ao `.gitignore`.

### 5.7 O4/O10 — Mapa Leaflet e demais integrações

- **Leaflet:** adicione no `<head>` de `relatos.ejs` o CSS/JS do Leaflet (CDN) e inicialize o mapa
  em `app/public/js/relatos.js`, trocando o array mockado por
  `fetch('/api/relatos')` → `L.marker([latitude, longitude])` com `L.divIcon` colorido por `cor`.
  Os ícones de cor já existem no seed (`categorias_ocorrencia.cor`).
- **Notificações in-app:** ao moderar, insira em `notificacoes` para o autor
  (`tipo='moderacao'`, `titulo`, `mensagem`) e mostre o contador no header
  (`SELECT COUNT(*) FROM notificacoes WHERE usuario_id = ? AND lida_em IS NULL`).
- **Dados oficiais no banco (O10):** `ocorrencias_oficiais` espera `fonte_id` + `lote_id`. O caminho
  mais barato é um script `database/importar-ocorrencias.js` que lê `DADOS/alagamentos_defesa_civil_sp_2026.csv`,
  cria a linha em `fontes_dados`, cria `lotes_importacao` e insere as ocorrências com
  `dados_originais_json`. Depois disso, o ranking deixa de depender de `fetch` de CSV.
- **API externa + JWT (opcional):** se sobrar tempo, exponha `GET /api/v1/relatos` com JWT
  (`jsonwebtoken`) para consumo externo — é o cenário em que o JWT faz sentido (README 5.1).

---

## 6. Riscos e plano de contingência da demo (25/11)

| Risco | Probabilidade | Mitigação concreta |
|---|---|---|
| Mapa vazio na banca | Alta | Cada integrante cadastra 3 relatos reais **antes** de 20/11; o roteiro da demo começa por um bairro já populado |
| `/DADOS` ou CDN indisponível na sala | Média | Baixar Leaflet e simple-notify para `app/public/vendor/` na semana S8 (nada de CDN no dia) |
| Banco compartilhado sem dados | Média | Ter um dump (`mysqldump`) do banco com geografia + relatos de demo em `docs/demo/`; importar leva 1 minuto |
| Sessão cair no meio da demo | Baixa | `MemoryStore` reinicia com o servidor: **não reiniciar** durante a apresentação; cookie dura 8 h |
| Render dormir (plano free) | Média | Abrir `/health` 10 min antes para acordar a instância |
| Conflito de merge na véspera | Alta | Congelamento de 23–25/11: só correção de bug, PR revisada por outra frente |
| Esquecer `SESSION_SECRET` em produção | Média | Checklist abaixo; o log do servidor avisa quando a variável falta |

### Plano de contingência (o que fazer se a hospedagem falhar)

1. Demo principal no Render; **dois notebooks** com a versão local pronta.
2. `.env` local com banco MySQL local **já populado** (`npm run db:reset` + `npm run criar-usuario` + relatos).
3. Se o banco remoto cair: trocar `DB_HOST` no `.env` local e reiniciar (o app não tem nada hardcoded de banco).
4. Roteiro impresso com o caminho da demo: **cadastro → código → login → relato → moderação → mapa**.

### Checklist da véspera (24/11)

- [ ] `npm install` limpo em uma pasta nova + `npm test` verde (22+ testes)
- [ ] `.env` com `SESSION_SECRET`, `APP_URL` e `NODE_ENV=production` no servidor
- [ ] `npm run db:reset` executado e geografia conferida (`bairros: 513+`)
- [ ] `npm run criar-usuario -- --papel=administrador ...` → login em `/adm` funcionando
- [ ] ≥ 30 relatos de demonstração (2 por integrante, em bairros diferentes)
- [ ] Um relato **pendente**, um **aprovado** e um **negado** para mostrar a moderação
- [ ] Mapa, filtros de categoria e de período testados no Chrome **e** no celular
- [ ] Manual (`docs/MANUAL.md`) e slides atualizados com as telas reais
- [ ] `docs/DECISOES.md` com o que foi decidido nas reuniões e por quê (para a banca perguntar)

---

## 7. Primeira tarefa depois desta leitura (30 minutos)

1. `cp .env.example .env` e preencher os dados do MySQL.
2. `npm install` e `npm run db:reset` (aplica o schema novo, com os ENUMs corrigidos e a view).
3. `npm run criar-usuario` → criar o **administrador**.
4. `npm start` e percorrer: `/cadastro-dados-pessoais` → código (aparece **no console**, modo dev) → `/login` → `/cadastro-preferencias` → `/`.
5. Entrar em `/adm` com o administrador e confirmar que aparece o painel (ainda mockado).
6. Abrir uma issue/PR por objetivo (O3 a O11) e marcar quem pega o quê na reunião de segunda.

