# Análise do código do ClimaFy — 26/09/2026

Confere as duas análises anteriores **contra o código** (commit `86b3930`, branch `main`) e
registra achados novos que nenhuma delas citou. Cada afirmação tem arquivo/linha.

## 1. Veredito dos 7 pontos

| # | Ponto | Veredito | Evidência no código | Situação após este commit |
|---|---|---|---|---|
| 1 | Cidade/bairro sem destino no modelo | **Real** — o dado era coletado e descartado | `usuarios` não tinha coluna de bairro; `preferencias_bairros` já existia (`schema.sql`); 3 fontes de verdade de bairro (mock de 3, lista fixa de 8, CSV real de 513) | ✅ bairro = `preferencias_bairros` via `bairro_id`; cidade virou campo derivado somente-leitura; mock e lista fixa removidos |
| 2 | Sequência única de cadastro | **Real e pior do que o texto** — não havia sequência nenhuma; `isComplete \|\| isTimerFinished` liberava o botão com timer zerado e "Preferências salvas" aparecia sem requisição | `cadastro-verificacao.js`, `cadastro-preferencias.js` (antes) | ✅ servidor cria conta → verifica código → login → preferências; timer só controla expiração/reenvio |
| 3 | Recriar o banco a cada alteração | **Real, mas prematuro** — sem dados a preservar o drop é aceitável | `schema.sql` DROP + `apply-schema.js` | ➖ mantido (decisão do grupo no README 8.1); `npm run db:reset` criado para dar nome explícito ao perigo |
| 4 | Auth/permissões antes das ações privadas | **Real — o mais grave** — todo `/adm*` era público com comentário admitindo isso | `router-adm.js` (antes) | ✅ `/adm*` exige sessão + e-mail verificado + papel; `bcryptjs` + `express-session` instalados |
| 5 | Aprovação × resolução | **Real** — `relatos.status` misturava `rejeitado` (moderação) com `resolvido` (situação) | `schema.sql` (antes) | ✅ status só com `aberto/em_andamento/resolvido` + view `vw_relatos_publicos` |
| 6 | Contratos front/back | **Real e já materializado** (senha divergente, sucesso sem requisição, dois formatos de erro) | `validacoesCadastro.js` vs checklist do front; `{error}` em `/api/bairros` vs HTML 422 | ✅ regra de senha única em `helpers/senha.js`; erro padronizado `{ erro }` / `{ erros: [] }`; tabela 6.2 do README atualizada |
| 7 | Organização em camadas | **Não-problema** — o repo já seguia a estrutura; faltavam só as pastas que nascem com a funcionalidade | — | ✅ `app/middlewares/` e `app/services/` criados com código real |

## 2. Achados novos (não estavam nas duas análises)

### 2.1 `/DADOS/*.csv` respondia 404 — home e ranking ficavam sem dados
`app/public/js/dados-publicos.js` faz `fetch('../DADOS/...')` a partir de `/js/`, ou seja
requisita `/DADOS/...`. O `express.static` só servia `app/public`, e não existia `app/public/DADOS`.
Resultado: a única funcionalidade com **dados oficiais reais** falhava em silêncio no `catch`.
→ corrigido com `app.use("/DADOS", express.static(...))` em `app.js`.

### 2.2 A tela de verificação tinha HTML quebrado
`cadastro-verificacao.ejs` incluía o partial `header` e, logo depois, repetia
`<section class="auth-actions">` + `</header>` órfão. A tela renderizava com markup inválido.
→ bloco órfão removido.

### 2.3 O e-mail mostrado na verificação era fixo
`<strong>se***@gmail.com</strong>` estava escrito no HTML, igual para todo mundo.
→ agora vem do servidor (`mascararEmail(req.session.cadastroPendente.email)`).

### 2.4 Não existia página de erro
`app.js` respondia JSON `{error}` até para rotas de página. Faltava `pages/erro.ejs`.
→ criadas `app/views/pages/erro.ejs` + `app/public/css/erro.css` e os handlers 404/500 separam API de página.

### 2.5 Dois conjuntos de categorias no seed
`schema.sql` insere 14 categorias em dois blocos: 6 com cor (usadas no relato) e 8 sem cor
(usadas nas preferências). São vocabulários diferentes para a mesma ideia.
→ **decisão pendente** (registrada no README 10.3).

### 2.6 `login.ejs` não tinha `name="email"` nem `action`
O formulário não enviava nada e `login.js` chamava `preventDefault()`.
→ corrigido: `action="/login" method="POST"`, `name="email"`, mensagens de erro/aviso renderizadas pelo servidor.

### 2.7 `npm install` e `.env` ausentes no clone
Sem `node_modules` (esperado, está no `.gitignore`) e **sem `.env`** a aplicação não sobe com banco.
→ criado `.env.example` documentando cada variável (inclui `SMTP_*` opcional, `SESSION_SECRET`).

## 3. Riscos que continuam abertos

| Risco | Por que importa | Mitigação registrada |
|---|---|---|
| Um único banco para todos | `npm run db:schema` apaga os dados de teste dos outros | README 8.2 (banco de dev separado) + `db:reset` explícito |
| Sessão em memória (`MemoryStore`) | Reinício do servidor derruba a sessão de todos | Aceitável na demo; migrar para store MySQL antes de produção |
| Sem proteção CSRF | `sameSite=lax` cobre o caso comum, não todos | Documentar em `docs/PLANO-ATE-25-11.md` (backlog) |
| Relato ainda é mock | `/new-report` não persiste | Objetivo 3 do plano |
