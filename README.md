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
| `app/middlewares/` | Login/permissões antes do controller | *(não existe)* | Com a autenticação (seção 5) |
| `app/services/` | Integrações externas (e-mail, storage) | *(não existe)* | Com o código de verificação (seção 4) |
| `app/config/` | Configuração de infraestrutura | `db.js` | — |
| `app/views/`, `app/public/` | EJS + CSS/JS do navegador | `pages/`, `css/`, `js/` | — |
| `database/` | Schema, migrations e geografia | `schema.sql`, CSVs | Seção 8 |

Regra: **SQL só em `app/models/`**. Controller não escreve query; view não decide regra.

### 1.3 Scripts [DECIDIDO]

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o servidor (`PORT` ou 3000) |
| `npm test` | Testes unitários (`node --test`) |
| `npm run db:schema` | Aplica `database/schema.sql` (**hoje: apaga tudo e recria**) + geografia — ver seção 8 |

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
| **bcrypt/argon2** | `usuarios.senha_hash` | Nunca texto puro; `senha_hash` nunca sai em resposta |
| **SHA-256** | `codigos_verificacao_email.codigo_hash` | — |
| **UUID (`public_id`)** | URLs públicas de usuário/relato | `id` sequencial interno nunca exposto em URL |
| **express-validator** | Validação de entrada em toda rota que lê `req.body`/`req.query` | Substituir regras do helper central |

**Por que sessão, não JWT:** o app é server-rendered, com links e POST de formulário. Cookie HttpOnly é o encaixe natural: mantém o token fora do JavaScript (mitiga XSS por padrão) e simplifica o guard das páginas. JWT faria sentido com front separado consumindo API pura — não é o caso hoje.

### 5.2 Papéis [DECIDIDO — reflete o seed do schema]

| Papel (`papeis.codigo`) | Herda | Pode |
|---|---|---|
| `cidadao` | — exige login para criar relatos| Criar/ver seus relatos, votar, definir preferências | 
| `moderador` | `cidadao` | + Moderar relatos (aprovar/rejeitar/solicitar ajuste em `moderacoes_relato`) |
| `administrador` | `moderador` | + Administrar sistema, importar dados públicos, gerir usuários, ver logs de auditoria |

### 5.3 Proteção de rotas [DECIDIDO]

| Grupo de rotas | Papel mínimo | Pré-condição |
|---|---|---|
| `/`, `/sobre`, `/ranking`, `/relatos`, `/login`, páginas de bairro | público | — |
| Envio de relato, `/api/preferencias`, voto | `cidadao` | e-mail verificado |
| `/adm/*` | `administrador` (moderação aceita `moderador`) | e-mail verificado |

Implementação: `app/middlewares/exigirAutenticacao.js` + `exigirPapel(...)` como **primeiro** middleware das rotas privadas (o comentário em `router-adm.js` já prevê). Bibliotecas a instalar: `bcrypt` e `express-session`.

### 5.4 Níveis de acesso do sistema [DECIDIDO]

| Nível | Papel no banco (`papeis.codigo`) | Permissões |
|---|---|---|
| **Visitante** (não autenticado) | — | Visualizar pesquisas; visualizar relatos públicos; criar conta / fazer login |
| **Usuário logado** | `cidadao` | Tudo do visitante **+** criar relatos; editar e excluir somente os **próprios** relatos; alterar preferências, endereço e senha |
| **Moderador** | `moderador` | Tudo do usuário logado **+** visualizar relatos que violem as regras; ocultar e editar esses relatos |
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
| GET | `/api/bairros?busca=` | `busca` (≤100) | 200 `[{id, nome}]` | 400 `{erro}` | Existe (mock → trocar pelo banco, seção 3) |
| POST | `/cadastro-dados-pessoais` | tabela 6.3 | 303 → `/cadastro-verificacao` | 422 re-render | Persistência pendente |
| POST | `/api/verificacao` | `codigo` (6 dígitos) | 200 | 422 inválido/expirado | Pendente |
| POST | `/api/verificacao/reenviar` | — | 200 | 429 se rápido demais | Pendente |
| POST | `/api/preferencias` | `bairros[]` (ids), `frequencia` | 200 | 422 | Pendente |
| POST | `/login` | `email`, `senha` | redirect (ou 403 se pendente) | 401 credenciais | Pendente |
| POST | `/logout` | — | redirect `/` | — | Pendente |

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

- **Opção A (APROVADA):** publicação **derivada** — o relato aparece publicamente se e somente se a **última** decisão em `moderacoes_relato` for `aprovado` e `deleted_at IS NULL`. Sem coluna nova.

- `relatos.status` fica **apenas** com valores de situação (`aberto`, `em_andamento`, `resolvido`); `rejeitado` sai do status e vive só na moderação.
- Rejeitado ⇒ não publicado, mas **não** significa resolvido. "Aprovado" **nunca** é tratado como "resolvido": aprovar libera a exibição; a situação segue `aberto` até mudança explícita.
- Toda mudança de situação grava linha em `historico_status_relato` (quem, quando, de → para, observação).

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

*Este documento substitui ordens divergentes em briefing ou conversa. Divergência encontrada = corrigir aqui primeiro.*