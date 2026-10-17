# ClimaFy — Plataforma de Monitoramento Climático Comunitário

Plataforma web (TCC) para monitoramento hiperlocal de eventos climáticos na cidade de São Paulo: relatos da população, dados oficiais (Defesa Civil / GeoSampa) e execução orçamentária por subprefeitura, combinados em um ranking público.

---

## 📌 Sobre este documento

Este README é a **fonte única de verdade** do projeto. Toda decisão de produto/engenharia precisa estar registrada aqui **antes** de virar código. Isso elimina divergências entre briefing, front-end e back-end: se um comportamento não está aqui, ele não existe.

### Níveis de decisão

| Rótulo | Significado |
|---|---|
| **[DECIDIDO]** | Acordado pelo grupo; vale como contrato. Mudar exige consenso + atualização aqui, na mesma PR |
| **[PROPOSTA]** | Redigido a partir da análise do código; **aguarda aprovação em reunião** |
| **[PENDENTE]** | Sem decisão ainda; **não implementar** sem registrar aqui primeiro |

**Regra de ouro:** código e documento atualizam **juntos**, na mesma PR. Se o código divergir deste documento sem o documento ter sido atualizado, **o código é quem está errado**.



## 1. Stack e organização do código

### 1.1 Stack [DECIDIDO — reflete o código atual]

| Camada | Tecnologia | Observação |
|---|---|---|
| Servidor | Node.js + Express 5 — app **server-rendered (EJS)** | Navegação por links e POST de formulário tradicionais |
| Banco | MySQL 8 (Clever Cloud), driver `mysql2` com pool | `app/config/db.js` |
| Validação | `express-validator` | `app/helpers/validacoesCadastro.js` |
| Testes | `node --test` | `tests/` — 4 testes passando |


### 1.2 Onde cada coisa mora [DECIDIDO]

| Pasta | Responsabilidade | Exemplos atuais | Nasce quando |
|---|---|---|---|
| `app/routes/` | Rotas + encadeamento de middlewares/validações | `router.js`, `router-adm.js` | — |
| `app/controllers/` | Recebe a requisição, coordena resposta | `controllers.js`, `bairroControllers.js` | — |
| `app/models/` | Consulta/gravação no banco (único lugar com SQL) | `bairroModel.js` (hoje mock) | — |
| `app/helpers/` | Validações e utilitários puros | `validacoesCadastro.js` | Regra usada em 2+ lugares |
| `app/middlewares/` | Login/permissões antes do controller | `exigirAutenticacao.js` (`exigirAutenticacao`, `exigirPapel`, `exigirEmailVerificado`), `exigirCadastroPendente.js` | ✅ criado (seção 5) |
| `app/services/` | Integrações externas (e-mail, storage) | `emailService.js` (nodemailer com modo desenvolvimento) | ✅ criado (seção 4) |
| `app/config/` | Configuração de infraestrutura | `db.js` | — |
| `app/views/`, `app/public/` | EJS + CSS/JS do navegador | `pages/`, `css/`, `js/` | — |
| `database/` | Schema, migrations e geografia | `schema.sql`, CSVs | Seção 8 |

Regra: **SQL só em `app/models/`**. Controller não escreve query; view não decide regra.

### 1.3 Scripts [DECIDIDO]

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o servidor (`PORT` ou 3000) |
| `npm run dev` | Igual ao start, com reinício automático (`node --watch`) |
| `npm test` | Testes unitários (`node --test`) — rodam sem banco (pool falso em `tests/support/`) |
| `npm run db:schema` | Aplica `database/schema.sql` (**hoje: apaga tudo e recria**) + geografia — ver seção 8 |
| `npm run db:reset` | Mesmo comando, nome explícito para o reset destrutivo |
| `npm run criar-usuario` | Cria usuário direto no banco (use para o **primeiro administrador**) — aceita `--email= --nome= --sobrenome= --papel= --senha=` ou pergunta no terminal |

### 1.4 Configuração [DECIDIDO]

`.env` (não versionado): `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, opcional `DB_PORT`/`PORT`. Credenciais nunca em código nem em docs.

---

## 2. Cobertura territorial [DECIDIDO]

- O projeto cobre **apenas a cidade de São Paulo**.
- Fontes carregadas: GeoSampa (96 distritos oficiais + 32 subprefeituras) e OpenStreetMap (513 bairros) — `database/carregar-geografia.js`.
- O gerador `database/fontes/gerar-geografia.js` filtra bairros por ponto-dentro-do-distrito: dados de municípios vizinhos (ex.: Barueri/Alphaville) existem só no arquivo bruto `osm-bairros.json` e **não entram** no banco.
- O schema já suporta outras cidades; adicionar uma é tarefa futura e atualiza este documento.

---
## 3. Cidade e bairro no cadastro [PROPOSTA]

**Problema:** o formulário coleta `cidade` e `bairro` como texto livre, mas `usuarios` não tem colunas para guardá-los (dados coletados e descartados).

**Decisão proposta:** bairro no cadastro é **preferência de acompanhamento**, não endereço residencial.

| Item | Decisão |
|---|---|
| Campo bairro | Seleção com autocomplete, fonte única = `GET /api/bairros` (dados reais do banco) |
| Campo cidade | **Exibição derivada** do bairro escolhido (`bairros.cidade_id` → `cidades.nome`); não é coletada |
| Persistência | `preferencias_bairros (usuario_id, bairro_id)` — "bairros que acompanho" |
| Endereço residencial | **Não armazenamos.** Se um dia for necessário, modela-se explicitamente e atualiza-se este documento |
| Remover | Lista hardcoded (8 bairros) em `app/public/js/cadastro-preferencias.js` e mock (3 bairros) em `app/models/bairroModel.js` — substituídos pela API real |

**Por quê:** todo relato já carrega o próprio `bairro_id`; a residência do usuário não é usada em nenhum lugar do modelo; e preferência é dado menos sensível que residência (LGPD).

---

## 4. Sequência canônica do cadastro [PROPOSTA]

**Problema:** hoje cada tela funciona isolada, sem estado no servidor; o navegador "confirma" etapas que o servidor nunca conferiu (o timer libera o botão; "Preferências salvas" aparece sem requisição).

### 4.1 Fluxo único [DECIDIDO]

Dados pessoais
   → servidor cria conta (senha hasheada) + gera código
Verificação de e-mail
   → servidor confere código (expiração + tentativas)
OPÇÃO A: login explícito → preferências
Verificação OK → tela de login → usuário digita email + senha → sessão criada → preferências


### 4.2 Regras invioláveis (qualquer fluxo)

1. **O temporizador não libera nada.** "Confirmar" exige 6 dígitos; expirou = reenviar, nunca "avançar sem código" (hoje o botão ativa quando o timer zera — corrigir).
2. O servidor confere o código (`codigos_verificacao_email`: hash, `expira_em`, `tentativas`) e só então grava `email_verificado_em`.
3. Preferências só são salvas com **usuário identificado** (sessão); a mensagem "Preferências salvas" só aparece após resposta 2xx (hoje é falsa — corrigir).
4. Etapas não são acessíveis fora de ordem; o servidor valida o estado (ex.: `/cadastro-verificacao` sem conta criada volta ao início).
5. Usuário permanece **não verificado** até o servidor confirmar o código; login exige `email_verificado_em IS NOT NULL`.

### 4.3 Mapa de telas e rotas

| Tela | GET | POST esperada | Status |
|---|---|---|---|
| Dados pessoais | `/cadastro-dados-pessoais` ✅ | mesma rota: criar conta + gerar código | Parcial — hoje só valida e ecoa JSON |
| Verificação | `/cadastro-verificacao` ✅ | `/api/verificacao` + `/api/verificacao/reenviar` | Pendente |
| Preferências | `/cadastro-preferencias` ✅ | `/api/preferencias` | Pendente |
| Login | `/login` ✅ | `/login`, `/logout` | Pendente (form sem action) |

---
## 5. Autenticação e níveis de acesso [PROPOSTA]

**Problema:** nenhuma rota exige login hoje; todo o painel `/adm*` é público; não há biblioteca de auth instalada. A única menção a JWT é decorativa (página Sobre) e **não é** critério de escolha técnica. 

Criar email de acesso adm e senha

### 5.1 Onde usar cada mecanismo

| Mecanismo | Usar em | Não usar em |
|---|---|---|
| **Sessão + cookie HttpOnly** | Autenticação do app web inteiro | — |
| **JWT** | Nada hoje. Reservado para API pública sem cookie, se um dia existir (decisão futura registrada aqui) | Sessão do app server-rendered |
| **bcryptjs** | `usuarios.senha_hash` | Nunca texto puro; `senha_hash` nunca sai em resposta. `bcryptjs` é JavaScript puro (mesma API do `bcrypt`) e instala sem compilar nada |
| **SHA-256** | `codigos_verificacao_email.codigo_hash` | — |
| **UUID (`public_id`)** | URLs públicas de usuário/relato | `id` sequencial interno nunca exposto em URL |
| **express-validator** | Validação de entrada em toda rota que lê `req.body`/`req.query` | Substituir regras do helper central |

**Por que sessão, não JWT:** o app é server-rendered, com links e POST de formulário. Cookie HttpOnly é o encaixe natural: mantém o token fora do JavaScript (mitiga XSS por padrão) e simplifica o guard das páginas. JWT faria sentido com front separado consumindo API pura — não é o caso hoje.

### 5.2 Papéis [DECIDIDO — reflete o seed do schema]

| Papel (`papeis.codigo`) | Herda | Pode |
|---|---|---|
| `cidadao` | — exige login para criar relatos| Criar/ver seus relatos, votar, definir preferências | 
| `moderador` | `cidadao` | + Moderar relatos e acessar todas as áreas/APIs implementadas do painel, incluindo usuários e dashboard (decisão de 16/10/2026) |
| `administrador` | `moderador` | + Administrar sistema, importar dados públicos, gerir usuários, ver logs de auditoria |

### 5.3 Proteção de rotas [DECIDIDO]

| Grupo de rotas | Papel mínimo | Pré-condição |
|---|---|---|
| `/`, `/sobre`, `/ranking`, `/relatos`, `/login`, páginas de bairro | público | — |
| Envio de relato, `/api/preferencias`, voto | `cidadao` | e-mail verificado |
| `/adm`, `/adm/*`, `/api/adm/*` | `moderador` (também aceita `administrador`) | conta ativa e e-mail verificado; escritas exigem CSRF |

Implementação: `app/middlewares/exigirAutenticacao.js` + `exigirPapel(...)` como **primeiro** middleware das rotas privadas (o comentário em `router-adm.js` já prevê). Bibliotecas a instalar: `bcrypt` e `express-session`.

> ✅ **Implementado em 26/09/2026:** `express-session` + `bcryptjs` no `package.json`; `/adm*`, `/new-report`, `/welcome` e `/cadastro-preferencias` protegidos; `POST /api/preferencias` devolve 401 sem sessão; visitante em `/adm` recebe 303 para `/login?proximo=/adm`, preservando o destino.

### 5.4 Níveis de acesso do sistema [DECIDIDO]

| Nível | Papel no banco (`papeis.codigo`) | Permissões |
|---|---|---|
| **Visitante** (não autenticado) | — | Visualizar pesquisas; visualizar relatos públicos; criar conta / fazer login |
| **Usuário logado** | `cidadao` | Tudo do visitante **+** criar relatos; editar e excluir somente os **próprios** relatos; alterar preferências, endereço e senha |
| **Moderador** | `moderador` | Tudo do usuário logado **+** moderação e todas as áreas/APIs implementadas do painel; bloqueio da própria conta e de administradores permanece proibido |
| **Administrador** | `administrador` | Acesso irrestrito a todas as funções do sistema; gerenciar configurações globais da aplicação |

Notas de implementação:

- Herança: cada nível tem **todas** as permissões do nível anterior (indicadas na tabela por "Tudo de...").
- "Editar/excluir seus relatos" aplica-se somente aos relatos de autoria do próprio usuário; o back-end valida o `usuario_id` da sessão antes de qualquer edição/exclusão.
- "Ocultar" é ação de moderação sobre a **publicação** do relato (ver seção 7); não altera a **situação** do problema.

---
## 6. Contratos frontend ↔ backend [PROPOSTA]

**Regra:** antes de ligar uma tela ao backend, preencher a linha dela em 6.2 e as validações em 6.3. O navegador nunca mostra sucesso sem resposta 20x (o x é o 1, 2 ou 3).


Faixa	Significado	Exemplos
1xx	- Informativo	100 (continuar) — raro no dia a dia
2xx	- Sucesso — o servidor conseguiu processar	200, 201, 204
3xx - Redirecionamento	301 (mudou de endereço), 303 (ver outro)
4xx - Erro do cliente (algo na requisição)	400, 401, 403, 404, 422
5xx - Erro do servidor	500

### 6.1 Formato de resposta e erro

- **Rotas de página** (form server-rendered): sucesso = **redirect 303** para a etapa seguinte; erro de validação = **422 + re-render** com `erros[]` e `valores{}` (padrão já usado em `controllers.js`).
- **Rotas de API** (`/api/*`): sucesso = **200 + JSON**; erro = JSON único `{ "erro": "..." }` ou `{ "erros": ["...", "..."] }` com status correto (400 entrada inválida, 401 sem login, 403 sem permissão, 404 não achou, 422 validação, 500 inesperado).
- API não devolve HTML; rota de página não devolve JSON cru (hoje `POST /cadastro-dados-pessoais` devolve JSON a um form HTML — ajustar para redirect).

### 6.2 Endpoints (tabela viva — atualizar a cada tela conectada)

| Método | Rota | Entrada | Sucesso | Erro | Status |
|---|---|---|---|---|---|
| GET | `/api/bairros?busca=` | `busca` (≤100) | 200 `[{id, nome, cidade}]` (até 20) | 400 `{erro}` | ✅ Implementado (consulta real, seção 3) |
| POST | `/cadastro-dados-pessoais` | tabela 6.3 (`bairro` = **id**) | 303 → `/cadastro-verificacao` | 422 re-render com `erros[]` + `valores{}` | ✅ Implementado (cria conta + código) |
| POST | `/api/verificacao` | `codigo` (6 dígitos) | 200 `{ok, mensagem, redirecionar}` | 422 inválido/expirado/sem tentativas; 400 sem cadastro pendente | ✅ Implementado |
| POST | `/api/verificacao/reenviar` | — | 200 `{ok, mensagem, segundosRestantes, cooldown}` | 429 `{erro, cooldown}` | ✅ Implementado |
| POST | `/api/preferencias` | `bairros[]` (ids), `categorias[]` (slugs), `frequencia` | 200 `{ok, mensagem, redirecionar}` | 401 sem sessão; 422 validação | ✅ Implementado |
| POST | `/login` | `email`, `senha`, `proximo` (opcional) | 303 → `/` ou `/cadastro-preferencias` (ou `proximo`) | 401 credenciais; 403 conta bloqueada/não verificada | ✅ Implementado |
| POST/GET | `/logout` | — | 303 → `/` | — | ✅ Implementado |

### 6.3 Validação por campo (resolve divergências existentes)

| Campo | Front hoje | Back hoje | Regra definitiva proposta |
|---|---|---|---|
| `nome` | required, só letras | trim, min 2 | min 2, **max 120**, letras/espaço |
| `sobrenome` | required | min 2 | min 2, max 80 |
| `email` | type=email | isEmail | isEmail, **max 190**, único (erro amigável) |
| `senha` | min 8 + checklist (maiúsc./minúsc./número/símbolo) | **regra completa no backend** (8+, uma de cada classe); 
| `confirma-senha` | validação custom | custom (= senha) | igual à senha |
| `cidade` | texto livre | notEmpty | **removida** (derivada do bairro — seção 3) |
| `bairro` | texto livre | notEmpty | **id válido** de `/api/bairros` |
| `termos` | checkbox required | equals `aceito` | equals `aceito` |
| código OTP | 6 dígitos | — | 6 dígitos numéricos; conferir `expira_em` + limite de `tentativas` | em relação ao tempo em que o codigo expira, pode ser 5 min


## 7. Relato: moderação × situação [DECIDIDO]

São duas dimensões diferentes:

- **Moderação** = o conteúdo pode aparecer? (`moderacoes_relato.decisao`: `aprovado` / `rejeitado` / `solicitado_ajuste`)
- **Situação** = o problema segue aberto? (estado do problema no mundo real)

### 7.1 Vocabulário único

| Conceito | Valor no banco | Rótulo no front | Quem define |
|---|---|---|---|
| Decisão de moderação | `moderacoes_relato.decisao` | Aprovado / Negado / Ajuste | Moderador/Admin |
| Situação do relato | `relatos.status` | Aberto / Em andamento / Resolvido | Moderador/Admin (e autor, conforme fluxo aprovado) |

### 7.2 Regra de publicação (a que faltava)

- **Opção A (APROVADA):** publicação **derivada** — o relato aparece publicamente se e somente se a **última decisão da versão atual** em `moderacoes_relato` for `aprovado` e `deleted_at IS NULL`. Não há flag de publicação independente. Em 15/10/2026, com autorização, foram acrescentadas versões do conteúdo para que editar não reaproveite a aprovação antiga (seção 10.9).

- `relatos.status` fica **apenas** com valores de situação (`aberto`, `em_andamento`, `resolvido`); `rejeitado` sai do status e vive só na moderação.
- Rejeitado ⇒ não publicado, mas **não** significa resolvido. "Aprovado" **nunca** é tratado como "resolvido": aprovar libera a exibição; a situação segue `aberto` até mudança explícita.
- Toda mudança de situação grava linha em `historico_status_relato` (quem, quando, de → para, observação).

> ✅ **Aplicado no schema em 26/09/2026:** os ENUMs de `relatos.status` e de `historico_status_relato` passaram a aceitar só `aberto` / `em_andamento` / `resolvido`, e a view **`vw_relatos_publicos`** implementa a Opção A. Toda consulta pública usa a view — não replique o JOIN com `moderacoes_relato` em cada tela.

---
## 8. Banco de dados

### 8.1 Comportamento atual [DECIDIDO]

`npm run db:schema` aplica `database/schema.sql`, que faz **DROP de todas as tabelas** e recria + recarrega a geografia. Enquanto não houver dados a preservar, é aceitável. Irei manter, pois evita problemas e bugs emrelação ao banco.

### 8.2 Política-alvo [PROPOSTA — entra em vigor APÓS a aprovação deste acordo]

1. **Separar bancos:** o `.env` de cada integrante aponta para um banco **descartável** de desenvolvimento; o banco compartilhado (Clever Cloud) recebe apenas o que está estável. (Não é necessario se tiver o drop database)
2. **Baseline:** o `schema.sql` atual vira referência de estrutura completa (continua servindo para criar um banco do zero).
3. **Reset vira exceção:** o script atual é renomeado para `db:reset` (usar só em banco descartável); `db:schema` deixa de apagar nada. (não é necessário)


### 8.3 Convenções [DECIDIDO — já seguidas pelo schema]

BIGINT AUTO_INCREMENT; `public_id` UUID só em `usuarios`/`relatos`; utf8mb4 / utf8mb4_0900_ai_ci; InnoDB; DECIMAL (nunca FLOAT) para valores e coordenadas; DATETIME em UTC; contadores calculados por consulta (não armazenados).

---

## 9. Glossário

| Termo | Significado |
|---|---|
| **Distrito** | Divisão territorial OFICIAL (Lei 13.399/2002); base dos cruzamentos |
| **Subprefeitura** | Agrupamento oficial de distritos; base do ranking |
| **Bairro** | Recorte popular (OSM); usado em formulários/filtros; nunca é a base oficial |
| **Relato** | Problema reportado por usuário autenticado |
| **Ocorrência oficial** | Registro público importado por lote (Defesa Civil etc.) |
| **Moderação** | Decisão sobre a publicação do conteúdo |
| **Situação** | Estado do problema (aberto / em andamento / resolvido) |
| **Snapshot** | Ranking calculado por subprefeitura em um período |
| **Papel** | Perfil de acesso (cidadao / moderador / administrador) |

---

---

## 10. Estado da implementação — 26/09/2026

Resumo do que já está no código. O plano com prazos até **25/11/2026** está em
[`docs/PLANO-ATE-25-11.md`](docs/PLANO-ATE-25-11.md).

### 10.1 Pronto e verificado

| Item | Onde |
|---|---|
| Cadastro persistente (senha com `bcryptjs`, consentimento dos termos na mesma transação) | `app/models/usuarioModel.js`, `app/controllers/controllers.js` |
| Código de verificação de 6 dígitos com hash SHA-256, expiração de 5 min, limite de 5 tentativas e cooldown de reenvio de 60 s | `app/models/verificacaoModel.js`, `app/helpers/codigoVerificacao.js` |
| Login com sessão + cookie HttpOnly, bloqueio de conta inativa e de e-mail não verificado | `app.js`, `app/middlewares/exigirAutenticacao.js` |
| Perfil de acesso: `exigirPapel('moderador'|'administrador')` com herança | `app/middlewares/exigirAutenticacao.js`, `app/routes/router-adm.js` |
| Preferências (bairros, categorias, frequência) gravadas em transação | `app/models/preferenciaModel.js`, `app/controllers/preferenciasControllers.js` |
| Bairros reais do banco no autocomplete (513 bairros, sem mock/lista hardcoded) | `app/models/bairroModel.js`, `app/public/js/bairro-autocomplete.js` |
| Envio de e-mail (nodemailer) com **modo desenvolvimento** que imprime o código no console | `app/services/emailService.js` |
| Moderação × situação separadas no schema + view `vw_relatos_publicos` | `database/schema.sql` (seções 3.2, 3.5, 3.7, 3.8) |
| Erro padronizado: página re-renderiza HTML (422/401/403), API responde `{ erro }` / `{ erros: [] }` | `app.js`, `app/helpers/errosValidacao.js` |
| CSVs oficiais servidos em `/DADOS/*` (home e ranking voltaram a ter dados) | `app.js` |
| Testes sem banco (pool falso) | `tests/` — 22 testes |

### 10.2 Ainda não implementado (ordem do plano)

1. Integração dos cards/mapa da home. Envio, consulta, votos e edição/exclusão dos próprios relatos já implementados; ver seções 10.8/10.9 e `docs/RELATOS-E-MODERACAO.md`.
2. Correção após ajuste implementada na edição pelo autor: novo conteúdo volta à fila pendente, sem reaproveitar aprovação anterior. Sem pendência adicional deste fluxo neste bloco.
3. Dashboard e listagem de usuários com dados do banco (`/adm`, `/adm/usuarios`).
4. Gerenciamento de perfil (trocar nome/senha autenticado). Recuperação de senha já implementada e confirmada pelo usuário (10.7).
5. Upload de foto com multer (tabela `relato_midias` já existe).
6. Notificações in-app + e-mail de acompanhamento (`notificacoes`, `preferencias_notificacao`).
7. Integração das ocorrências oficiais (`ocorrencias_oficiais`) e do orçamento no banco, em vez de CSV no navegador.
8. Deploy e dados de demonstração.

### 10.3 Pendências de decisão do grupo

- **Lista única de categorias:** hoje existem 14 categorias no seed, em dois blocos (6 com cor para relato + 8 sem cor para preferência). Decidir se preferências passa a usar as mesmas 6 do relato e registrar aqui.
- **JWT:** segue reservado para uma futura API pública (seção 5.1). Não usar na sessão do app.
- **Banco de desenvolvimento separado:** seção 8.2 continua [PROPOSTA]; enquanto isso, `db:reset` destrói o banco compartilhado.

---

### 10.4 Revisão pontual de login e permissões — 27/09/2026

- Login renova o identificador da sessão e espera a gravação antes de redirecionar. Apenas a sugestão de bairro é preservada da sessão anterior.
- Toda rota que usa `exigirAutenticacao` consulta o usuário no banco: conta bloqueada, inativa, excluída ou sem e-mail verificado perde a sessão. Mudanças de papel valem na próxima requisição privada.
- Falhas na consulta não liberam acesso usando permissões antigas; são encaminhadas ao handler de erro.
- O destino após login rejeita URLs externas, barras invertidas e caracteres de controle. O logout limpa o cookie após encerrar a sessão.
- Testes adicionados: `tests/autenticacao.test.js` (regras isoladas) e `tests/login.test.js` (rotas HTTP reais com cookies e banco simulado). Não comprovam conexão, gravação no MySQL ou entrega de e-mail real.
- Este bloco não altera schema, `.env`, telas nem dependências. CSRF, limites de tentativas, armazenamento persistente de sessões e confiabilidade do envio/verificação de e-mail continuam pendentes antes da publicação.

### 10.5 Confirmação de cadastro em transação — 27/09/2026

- `verificacaoModel.confirmarCadastro` confere a conta e o código, conta tentativas, consome o código e grava `email_verificado_em` na mesma transação. Uma falha solicita rollback, em vez de deixar a conta parcialmente verificada.
- Criação e confirmação de código travam primeiro a mesma linha de usuário (`FOR UPDATE`). Confirmações da mesma conta são serializadas; a quinta tentativa errada já invalida o código.
- A expiração na confirmação é comparada com `UTC_TIMESTAMP()` no banco, não com o contador do navegador. O controller usa a identidade da sessão, nunca um usuário recebido no corpo da requisição.
- `tests/verificacaoModel.test.js` e `tests/verificacaoController.test.js` verificam decisões, ordem das consultas, rollback e respostas com banco simulado. A integração e a concorrência no MySQL real ainda precisam de validação em ambiente de testes.
- Escopo deste passo: confirmação de cadastro. Falhas de SMTP, recuperação do cadastro após falha de envio e limitação transacional dos reenvios continuam pendentes. O JavaScript da tela fica reservado ao exercício do integrante.

*Este documento substitui ordens divergentes em briefing ou conversa. Divergência encontrada = corrigir aqui primeiro.*

### 10.6 Correções de recuperação do cadastro e JSON — 15/10/2026

- Cadastro guarda a etapa pendente antes de tentar enviar o código. Falha de SMTP não apaga a conta, não autentica o usuário e permite retomar a verificação/reenvio na tela existente. Entrar com a senha correta também retoma uma conta ainda não verificada, mesmo com o SMTP indisponível.
- `verificacaoEmailService` coordena código no banco e envio, retornando confirmação explícita e a expiração realmente gravada. Falha do banco continua propagando; não é mascarada como problema de e-mail.
- Reenvio sem confirmação retorna **503** com mensagem e cooldown; só retorna sucesso quando o serviço confirma o envio ao SMTP. Isso não garante chegada à caixa de entrada. Cooldown e validação do código continuam obrigatórios.
- Em produção sem SMTP configurado, não há fallback que imprime o código em logs. O modo de desenvolvimento continua disponível fora de produção, mas não é anunciado como envio real.
- JSON malformado retorna **400**, em JSON para `/api/*` e HTML para páginas, sem expor o corpo recebido. Erros internos continuam **500**.
- Ajustados somente texto e estado do aviso na página de verificação existente; nenhum layout, CSS ou página nova foi criado neste bloco.
- Verificação: **130 testes passaram**, incluindo falha de SMTP, retomada pelo login, reenvio, sessão, confirmação do código e tratamento de JSON. Modelos/SMTP simulados; nenhum dado do banco real nem credencial foi alterado e nenhum e-mail real foi enviado pelos testes. Sessões persistentes e os demais preparativos de produção continuam pendentes.

### 10.7 Recuperação de senha — 15/10/2026

- O link **Esqueceu sua senha?** do login abre o modo de recuperação do próprio `login.ejs`. Nenhuma página, dependência ou tabela nova; sem alterações de CSS, `.env` ou permissões de usuário.
- `GET /recuperar-senha`: formulário de e-mail e token CSRF de sessão. `POST /recuperar-senha`: valida o e-mail e apresenta o formulário do código/nova senha, com mensagem genérica para não revelar contas existentes. `POST /resetar-senha`: recebe `email`, `codigo`, `senha`, `confirma-senha` e `_csrf`.
- O Nodemailer existente envia código aleatório de 6 dígitos, válido por 5 minutos. Somente o hash vai para `codigos_verificacao_email`, com finalidade `recuperacao_senha` (não se confunde com cadastro). Máximo de 5 tentativas por código; reenvio após 60 segundos, até 5 emissões por conta/hora. Pedidos limitados não invalidam o código atual.
- Emissão e redefinição usam transação e trava da mesma conta. Expiração é conferida com o relógio do MySQL. Consumo e troca da senha são atômicos; código usado não pode ser reutilizado. Só contas ativas e não excluídas; redefinir não confirma e-mail, não desbloqueia e não altera papel.
- Nova senha segue a complexidade do cadastro, com confirmação e limite adicional de 72 bytes para evitar truncamento do bcrypt. Senha/código nunca são repostos nos campos após erro. Sucesso renova a sessão, volta ao login e tenta enviar aviso da alteração; não autentica automaticamente.
- A assinatura interna do hash da senha fica na sessão (fora de `res.locals.usuario`). O guard compara com o banco antes de liberar cada rota privada: mudar a senha revoga as sessões antigas na próxima requisição privada. Sessões abertas antes deste bloco também precisam de novo login.
- CSRF e `Cache-Control: no-store` no fluxo. Limites adicionais por IP/processo: 10 solicitações e 30 confirmações em 15 minutos, com memória limitada e resposta 429. Para várias instâncias, levar esses limites a um armazenamento compartilhado.
- O SMTP é disparado após a resposta para que demora/falha do provedor não diferencie a resposta de conta existente/inexistente. É envio em segundo plano no processo, **não uma fila durável**: reinício pode interromper o envio. Em falha, tentar novamente após o intervalo; uma fila persistente permanece como melhoria de produção. Os tempos de consulta ao banco ainda podem variar, apesar da mensagem/status uniformes.
- Base didática: **PSW3_011 — Recuperar Senha** (pedido → e-mail → prova temporária → nova senha com bcrypt → login), adaptada de JWT/link para o OTP e as sessões existentes. Proteções complementares: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
- Teste manual: reiniciar servidor → `/login` → **Esqueceu sua senha?** → informar e-mail → usar código mais recente → escolher/confirmar nova senha → entrar. Não usar `db:schema`/`db:reset` para isso.
- Verificação deste bloco: **161 testes passaram**, incluindo os 29 novos testes de recuperação/model e as regressões de sessão. Banco e SMTP simulados; nenhuma conta real alterada e nenhum e-mail real enviado pelo agente. A entrega real do e-mail e a recuperação da conta devem ser confirmadas pelo teste manual acima.

### 10.8 Votos nos relatos — 15/10/2026

- Implementados `app/models/votoModel.js` e `app/controllers/votoControllers.js`, seguindo a separação MVC já utilizada no projeto. Nenhuma dependência, página ou tabela nova; `.env`, EJS e CSS não foram alterados neste bloco.
- `GET /api/votos?relatos=UUID,UUID`: consulta privada de até 50 relatos por pedido. Responde `{votos: [{publicId, votos, votado, proprio, podeVotar}], csrfToken}`. Somente publicados entram na resposta; a identidade do autor não é exposta.
- `PUT /api/relatos/:publicId/voto`: garante que o usuário tenha um voto. `DELETE` no mesmo endereço: garante que não tenha voto. Ambos recebem corpo `{}` com `Content-Type: application/json` e `X-CSRF-Token`, e respondem `{ok, voto, mensagem}`. São idempotentes: repetir PUT não acrescenta outro voto; repetir DELETE não afeta ninguém mais.
- As rotas exigem sessão atual, conta ativa, e-mail verificado e papel de cidadão ou superior. Usuário vem exclusivamente da sessão; campos como `usuarioId`, `votar` e `votos` enviados pelo cliente não controlam identidade, operação ou contador. CSRF ausente/incorreto: 403; formato incorreto: 415/422; UUID/relato não disponível: 404.
- Não permite votar no próprio relato, nem inserir/retirar votos em relato que não esteja mais publicado. Não muda a situação, a decisão de moderação nem seu histórico. Usa a view de publicação existente; não inventa restrição adicional para relatos resolvidos.
- A transação trava usuário e relato (mesma ordem da moderação), consulta a publicação vigente e grava/conta os votos na mesma conexão. A primeira leitura de snapshot ocorre após a trava do relato; os escritores de votos/moderação são serializados por essa trava. A chave composta `(relato_id, usuario_id)` é a proteção final contra duplicidade.
- Em `relatos.js`, apenas o contador da **lista principal real** virou botão, mantendo classe `votes`, estrutura do footer e layout. Permite votar/retirar e fornece `aria-pressed`, rótulo e feedback. Visitante vai ao login somente ao clicar. Botão do autor fica desabilitado; os blocos demonstrativos/destaques continuam intactos e não recebem votação real.
- Consulta privada em lote não impede carregar a lista pública. Sem incremento otimista: o número só muda ao receber estado válido do servidor. Clique duplo é bloqueado. Falha de resposta exige consultar o estado antes de nova alteração; não há reenvio automático de mutação. Contagens/ordenação podem mudar por outros usuários e são atualizadas ao consultar novamente, não em tempo real.
- **188 testes passaram**, com banco/SMTP simulados, incluindo sessão/CSRF, autoria/publicação, PUT/DELETE repetidos, falhas, concorrência com travas simuladas e comportamento do navegador em DOM simulado. A estrutura do MySQL real foi conferida por `SHOW COLUMNS`/`SHOW INDEX`: tabela, chave composta e campos da view presentes. Nenhum voto/usuário real foi inserido ou removido pelo agente. Teste visual/manual e gravação real ainda devem ser confirmados pelo grupo.
- Teste manual: reiniciar servidor → entrar com conta **diferente da autora** → `/relatos` → clicar `▲` no card da lista principal → conferir confirmação → atualizar página → conferir permanência → clicar novamente → conferir retirada. Na conta autora, o botão deve ficar desabilitado.
- Referências técnicas: [MySQL — Locking Reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html) e [OWASP — CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

### 10.9 Edição e exclusão dos próprios relatos — 15/10/2026

- Sem página nova nem CSS novo. No detalhe de **Meus relatos**, o autor encontra **Editar relato** e **Excluir relato**. Edição reaproveita `new-report.ejs`/`new-report.js`, preenchendo campos, bairro e localização originais sem disparar geocoding que substitua esses dados. Textos iniciais são escapados no atributo HTML; não são interpolados em JavaScript executável.
- `GET /meus-relatos/:publicId/editar` abre o formulário somente para o dono. `GET /api/meus-relatos/:publicId` fornece `{relato, csrfToken}`. `PUT` na mesma API recebe todos os campos do envio e `versao` (string positiva consultada); `DELETE` recebe `{versao}`. Escritas exigem JSON, sessão ativa/verificada, papel cidadão ou superior e `X-CSRF-Token`. Autor é sempre o da sessão; outro autor ou registro indisponível recebe 404.
- Edição valida categoria/bairro/cidade ativos e deriva cidade do bairro. Preserva a situação/resolução do problema. A transação salva os campos anteriores em `relato_revisoes` e incrementa `relatos.versao_conteudo`; dados novos ficam pendentes até moderação da **nova versão**. Nenhuma decisão antiga é apagada, nem o cidadão é registrado como moderador. Votos e mídias do mesmo relato são mantidos; não são zerados automaticamente por uma correção.
- Salvar conteúdo idêntico não cria versão e não remove aprovação. Edição com versão desatualizada retorna 409, sem sobrescrever outra edição. Falha ao salvar o histórico reverte a atualização e vice-versa.
- Exclusão é lógica (`deleted_at`): retira o relato da publicação/listagens, preservando conteúdo, versões, votos, mídias e históricos. Exige confirmação no navegador; repetir a exclusão pelo próprio dono é seguro. Não há endpoint novo de restauração nem exclusão física neste bloco.
- Moderação/situação agora também recebem `versao`, além de `revisao`/`statusAnterior`. Uma decisão de uma aba antiga recebe 409 se o conteúdo mudou, inclusive quando as duas consultas tinham revisão `0`. Fila, motivos exibidos e view pública consideram somente a moderação da versão atual. Aprovar não resolve; editar não reabre o problema automaticamente.
- Migração aditiva `npm run db:migrate:edicao-relatos`, autorizada e **já aplicada no MySQL compartilhado**: duas colunas de versão com padrão 1, tabela de histórico e view ajustada. Conferência antes/depois por quantidade e hash dos campos originais: 1 relato, 1 decisão, 1 histórico de situação e 1 voto preservados integralmente. Os mesmos relatos continuaram publicados após a migração. Nenhum relato real foi editado/excluído pelo agente.
- Migração verifica tipos existentes, usa trava nomeada, limita espera por lock e pode ser reexecutada. DDL tem commit implícito: não promete rollback de schema; em falha parcial, corrigir a causa e reexecutar. **Não executar `db:schema`/`db:reset` no banco do grupo.** `.env` e dependências não foram alterados; só foi adicionado o atalho de migração ao `package.json`.
- **229 testes passaram**. Testes de backend/HTTP/DOM cobrem autoria, CSRF, campos, snapshots, rollback, versão antiga, reaprovação e confirmação de exclusão, além das regressões de criação/votos/login. O navegador automatizado não iniciou neste ambiente; a checagem visual e o fluxo real ficam para o teste manual abaixo.
- Teste manual: reiniciar servidor e atualizar as abas → **Meus relatos** → detalhes → **Editar relato** → alterar descrição e salvar → conferir que voltou à fila pendente e saiu do público → aprovar a versão atual como moderador → conferir publicação. Para exclusão, preferir um relato marcado TESTE; cancelar primeiro, depois confirmar e conferir que sumiu da exibição. Não testar exclusão de um registro importante sem intenção de ocultá-lo.
- Base: MVC, validação, sessões/autorização e integração MySQL dos materiais PSW. Referências complementares: [OWASP — IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) e [MySQL — Implicit Commit](https://dev.mysql.com/doc/refman/8.0/en/implicit-commit.html).

### 10.10 Painel administrativo: usuários e dashboard — 16/10/2026

- Telas existentes `/adm` e `/adm/usuarios` conectadas aos dados reais, sem página ou CSS novo. Investimentos e relatórios/exportações ainda não foram conectados neste bloco. Perfil e fotos continuam pausados.
- Usuários: busca, filtros, paginação e bloqueio/desbloqueio com confirmação, sessão atual de administrador, JSON e CSRF. Status e auditoria gravados na mesma transação; não permite bloquear administrador, reativar conta inativa ou mudar papel/verificação/senha. Convites e perfil ficam desabilitados, sem sucesso fictício.
- Dashboard: indicadores, fila da versão atual, atividade recente, categorias e 14 dias com zeros reais. Fuso de São Paulo e snapshot somente leitura por consulta. Os atalhos levam à moderação existente, sem simular decisões.
- Moderador continua acessando a moderação; somente administrador acessa usuários/dashboard. Nenhuma conta foi criada/promovida nem bloqueada pelo agente. Para criar uma conta operacional separada, usar o script interativo existente `npm run criar-usuario`, com papel `administrador`.
- **258 testes passaram**, incluindo 29 novos de backend/HTTP/DOM simulado. Consultas reais e estrutura da auditoria conferidas somente em leitura. Testes não substituem validação visual/manual do grupo. Nenhuma migração, alteração de `.env`, dependência, commit ou push neste bloco.
- Contrato, definições dos indicadores, limitações e roteiro de teste: [Painel administrativo](docs/PAINEL-ADMIN.md).

### 10.11 Acesso do moderador ao painel completo — 16/10/2026

- Por solicitação do responsável pelo projeto, **todos os usuários com papel `moderador`** também podem acessar dashboard, usuários, todos os relatos, investimentos e relatórios, além da moderação. Esta decisão substitui a restrição anterior da seção 10.10; não requer criar outra conta nem promover a existente no banco.
- As APIs de usuários/dashboard e a verificação transacional do operador aceitam moderador ou administrador. Cidadão, papel desconhecido, conta bloqueada/inativa ou e-mail não verificado continuam sem acesso. A hierarquia genérica de papéis não mudou; o painel passou a exigir papel mínimo `moderador`.
- CSRF, auditoria e proteção contra bloquear a própria conta ou uma conta de administrador continuam válidos. Abrir investimentos/relatórios não implementa as funcionalidades demonstrativas que ainda faltam nessas telas.
- Nenhum dado real, schema, `.env`, página ou CSS foi alterado neste ajuste. Reiniciar o servidor e acessar `/adm` com a conta existente de moderador.
- **259 testes passaram** após o ajuste, incluindo acesso do moderador a todas as páginas do painel e às APIs, CSRF e recusa de cidadãos/papéis desconhecidos. Testes com banco simulado; nenhuma conta real foi alterada.

### 10.12 Relatório CSV de relatos — 16/10/2026

- Card existente **Relatos por região** em `/adm/relatorios` conectado à exportação real. Filtros de período de criação (7/30/90/365 dias ou histórico), categoria, bairro/cidade e situação; 30 dias por padrão. Sem página nova, dependência ou alteração de CSS. Os outros cinco relatórios ficam sinalizados como pendentes, sem mensagens de sucesso fictício.
- `GET /api/adm/relatorios/filtros` consulta opções reais; `GET /api/adm/relatorios/relatos.csv` devolve UTF-8/BOM, delimitador `;`, aspas escapadas e download privado. Ambos exigem sessão atual de moderador/administrador e e-mail verificado. GET somente leitura, sem mudanças no banco nem contagem persistente de exportações.
- Uma linha por relato não excluído, inclusive em moderação; decisão mais recente da versão atual. Exporta somente UUID público, criação UTC, cidade/bairro, categoria, severidade, situação, moderação, versão e votos. Não exporta dados cadastrais dos autores, textos livres ou coordenadas. Limite de 5.000: exceder retorna 422 solicitando filtros, sem truncar silenciosamente.
- **284 testes passaram**, incluindo 25 novos de backend/HTTP/DOM. Conferência adicional no MySQL real somente em leitura: opções e consulta funcionaram, com 1 relato no período padrão. Arquivo gerado em memória, sem salvar CSV real ou alterar registros. Abertura e conferência visual ficam para o teste manual do grupo.
- Estrutura MVC e permissões seguem os materiais PSW. Contrato, limites, cuidados com fórmulas em planilhas e roteiro de teste: [Exportação CSV](docs/RELATORIO-CSV.md). Referência complementar: [OWASP — CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

### 10.13 APIs de notificações internas do autor — 16/10/2026

- Aprovação, rejeição, solicitação de ajustes e mudança efetiva de situação geram aviso ao autor na mesma transação da moderação. Falha inesperada ao gravar o aviso reverte a ação. Versão/revisão antiga continua recusada; situação idêntica não gera aviso duplicado.
- Decisão do responsável: avisos do próprio relato disponíveis imediatamente; frequência diária/semanal e silencioso reservados aos futuros alertas dos bairros. Canal interno desativado impede novos avisos. Autor deve estar ativo/verificado/não excluído; preferência ausente mantém canal habilitado. Sem e-mail, push, agendador ou notificações retroativas neste bloco.
- `GET /api/notificacoes` fornece apenas avisos da conta autenticada, resumo, paginação e CSRF, com filtro de não lidas. `PATCH /api/notificacoes/lida` recebe `{id: "..."}` e exige JSON/CSRF; marca apenas o aviso do dono e preserva a primeira data em repetições. GET não marca leitura. Conta visitante/bloqueada/sem verificação perde acesso; outro dono recebe 404.
- Por solicitação do responsável, **somente backend/contrato**: o time do front fará a integração visual. Nenhuma página, sino, CSS ou JavaScript de navegador novo. Contrato e exemplo de fetch: [Notificações — API para o front](docs/NOTIFICACOES-API.md).
- **308 testes passaram**, sendo 24 novos de models/HTTP. Schema do MySQL conferido e listagens validadas somente em leitura com usuário 0, sem avisos pessoais. Nenhuma notificação real foi criada/marcada, nenhum relato real foi alterado e nenhum e-mail foi enviado pelo agente. Sem migração, dependência ou mudança de `.env`; teste manual de gravação descrito no contrato.

### 10.14 Ranking no backend e importação autorizada — 16/10/2026

- Pesos confirmados pelo responsável: **65% ocorrências / 35% déficit relativo do valor realizado**, mantendo fórmula/classificação do projeto. `GET /api/ranking` público com período (`ano`, `7d`, `30d`, `90d`), busca e ordem. Usa último snapshot finalizado e lotes rastreáveis; sem publicação/inconsistência retorna 503, sem dados fictícios.
- Importação real autorizada e aplicada: **192 ocorrências, 32 linhas de orçamento, 4 snapshots, 128 resultados**, fontes/lotes/vínculos e auditoria, sem reset ou DDL. Uma ocorrência de 2025 preservada, mas excluída da anual de 2026: 191 ocorrências. Referência: **26/06/2026**, não hoje; janelas 7/30/90 dias: 10/10/15 ocorrências.
- Seis valores com ruído decimal foram arredondados em centavos para DECIMAL; linhas/percentuais originais preservados em JSON. Não inclui relatos dos usuários nem inventa distribuição de orçamento. A autenticidade/atualização externa dos CSVs não foi certificada neste bloco.
- Importador inicial com prévia, assinatura, operador moderador/administrador ativo/verificado, trava, transação e auditoria. Repetição real sem duplicação; arquivo diferente/dado incompatível é recusado, não sobrescrito. `dados:validar` e `dados:importar` sem argumentos só leem/validam. **Não executar `db:reset`/`db:schema` no banco do grupo.**
- Quantidades/conteúdo de contas, relatos, decisões, históricos, votos, revisões, notificações e preferências conferidos e preservados. **333 testes passaram**, além das consultas reais e idempotência. Sem mudança de `.env`, dependência, página, CSS ou JS do navegador. A página antiga ainda usa CSVs até o front conectar a API.
- Contrato/fórmula/limitações e roteiro para o front: [Ranking — API e importação](docs/RANKING-API.md).

### 10.15 API de investimentos/orçamento — 16/10/2026

- `GET /api/adm/investimentos` privado, somente leitura, para moderador/administrador ativo/verificado. Consulta o lote orçamentário concluído vinculado à publicação anual de 2026; não mistura arquivos sobrepostos. Filtros: ano disponível, busca, slug de subprefeitura, ordem e paginação.
- Retorna valores previstos/atualizados/congelados/descongelados/realizados por região, percentual informado, opções, proveniência e totais globais/filtrados. Valores monetários em texto decimal com duas casas; somas/ordenação em centavos. Percentual agregado é soma realizada / soma prevista, não média simples nem progresso físico; previsto zero resulta `null`.
- Não cria projeto, obra, status físico, CRUD de investimentos ou os relatórios adicionais pendentes. `/adm/investimentos` ainda é demonstrativo até o front conectar. Nenhuma página, CSS ou JavaScript de navegador foi alterado. O relatório consolidado para o frontend permanece para o final, conforme solicitado.
- **351 testes passaram**, com 18 novos de models/HTTP. MySQL real conferido somente em leitura: 32 regiões, paginação/filtros e totais exatos. Nenhum dado real, schema, dependência ou `.env` alterado. Fonte sem data externa informada; publicação no sistema não comprova atualidade/autenticidade externa.
- Contrato técnico do endpoint: [Orçamento — API](docs/ORCAMENTO-API.md).

### 10.16 Limitação de pedidos de login — 16/10/2026

- `POST /login` limitado antes da validação, MySQL e bcrypt: 50 pedidos por IP e 20 por e-mail em janelas de 15 minutos. Conta todos os pedidos (inclusive válidos), não só senhas erradas; variações de maiúsculas/espaços não liberam o e-mail. Trocar de IP não libera o limite da conta.
- Excesso retorna 429 com `Retry-After` e `no-store`, reutilizando a página de erro existente sem expor credenciais ou existência da conta. GET de login e recuperação seguem disponíveis; nenhum status de conta é alterado.
- Contadores efêmeros em memória, chaves HMAC, teto de memória e remoção de expiradas. Reinício zera contadores; múltiplas instâncias precisam de armazenamento compartilhado. Há risco de recusa temporária por consumo malicioso do limite de conta e de saturação global; não é proteção completa contra abuso.
- Sem alteração de telas/JS de navegador, banco, schema, dependências ou `.env`. Perfil, fotos e relatório consolidado para o front continuam pausados. Sessões persistentes, segredo de produção, revisão ampla de CSRF e deploy ainda pendentes.
- Limites, decisões, testes e pendências de segurança: [Segurança do login](docs/SEGURANCA-LOGIN.md).
- **362 testes passaram**, com 11 novos testes de middleware/HTTP e banco simulado. Nenhuma conta real foi usada para disparar tentativas, nenhum e-mail foi enviado e nenhum registro foi alterado neste bloco.

### 10.17 Backend de fotos/vídeos — 16/10/2026

- Cloudinary escolhido pelo responsável. SDK adicionado; upload autenticado pelo servidor, um arquivo opcional somente na criação: JPEG/PNG/MP4/WebM, 5 MiB, vídeo até 30 segundos. Memória limitada, CSRF antes de multipart, assinatura binária e confirmação de decodificação do provedor. Sem segredo/configuração global no front.
- Metadados de mídia, relato e histórico na mesma transação MySQL. Falha conhecida tenta limpar arquivo remoto; upload/commit incerto preserva objeto privado com aviso para reconciliação. Não há garantia de transação distribuída nem limpeza durável automática.
- APIs separadas de listagem/conteúdo públicas, do autor e da moderação. Regra pública usa view da versão aprovada; exclusão lógica/edição revogam acesso público. Download via proxy do backend sem expor link remoto permanente, com no-store/nosniff e Range único.
- Sem credenciais retorna indisponibilidade explícita e mantém criação JSON sem foto. Nenhum dado real, `.env`, schema, EJS, CSS ou JS de navegador alterado. Campo existente e apresentação dos anexos na moderação ainda precisam de integração; nenhuma página nova criada. Perfil e relatório consolidado para o front continuam para depois.
- Implementação/testes simulados não comprovam envio real, cotas do plano ou compatibilidade com o schema hospedado. Contrato, configuração local/Render e limites: [Mídias dos relatos](docs/MIDIAS-RELATOS.md).
- **397 testes passaram**, incluindo 35 novos de helpers, serviço, model e HTTP. Nenhum upload/download real ou escrita no MySQL compartilhado neste bloco. Validação de leitura assinada usa SDK real com credenciais fictícias e transporte simulado; não comprova disponibilidade do provedor.

### 10.18 Integração de anexos nas telas existentes — 16/10/2026

- Campo existente de `/new-report` conectado à configuração/CSRF e ao multipart. Seleção/arraste de um arquivo, validação local de tipo/tamanho e remoção de seleção; não define Content-Type manualmente. Sem anexo continua JSON; edição preserva os arquivos antigos. Erros mantêm dados/seleção e não disparam repetição automática.
- Detalhes existentes do público, autor e moderador exibem imagem/vídeo usando o endpoint correspondente, sem autoplay ou URL remota. Falha de consulta é diferente de lista vazia. Link da coluna de anexo na moderação substitui “Sem upload”. Sem página nova, alteração de arquivo CSS ou reestruturação do layout. Descrições alternativas detalhadas e legendas/transcrição de vídeos continuam sob revisão de acessibilidade do grupo.
- **408 testes passaram**, com 11 novos de DOM/integração. MySQL real conferido somente em leitura: colunas, CHECK de 5 MiB, MIME de vídeo e view compatíveis. Nenhum registro real, `.env`, dependência, commit ou deploy alterado neste bloco.
- Cloudinary respondeu 401/API Key recusada mesmo após a primeira correção. Responsável orientado a conferir o valor específico de API Key e Secret do mesmo par; nenhum valor exposto. Teste real de arquivo não iniciado, porque a autenticação falhou antes. Pendente confirmar credenciais e fluxo completo antes de atualizar o Render. O relatório consolidado para o front continua para o final.

### 10.19 Prévia da foto selecionada — 16/10/2026

- Após a correção do Cloud Name pelo responsável, autenticação, upload e leitura protegida de uma pequena imagem técnica funcionaram no Cloudinary. Arquivo temporário removido; nenhum relato criado no banco. Isso atualiza a pendência de autenticação de 10.18, mas não substitui teste completo pela tela nem teste real de vídeo.
- Campo de anexo existente mostra foto selecionada/arrastada em até 160 × 160 pixels, sem cortar/deformar nem comprimir o arquivo original. Prévia usa URL local do navegador, sem enviar bytes ao selecionar; remover/trocar libera a URL. Vídeos mantêm o fluxo anterior sem prévia local.
- **413 testes passaram**, com cinco novos casos de seleção, substituição, limpeza, erro/concorrência de leitura e retorno pelo histórico em DOM simulado. Sem página nova, arquivo CSS, alteração de banco, `.env`, dependência, commit ou deploy. Conferência visual fica para o teste manual do responsável.
