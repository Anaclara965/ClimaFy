# Painel administrativo — usuários e dashboard

Implementado em 16/10/2026, reaproveitando as páginas existentes. Este documento descreve usuários e dashboard. O relatório CSV de relatos foi conectado em seguida: ver [Exportação CSV](RELATORIO-CSV.md). Investimentos, outros relatórios, convites e gerenciamento de perfil continuam pendentes. Fotos continuam adiadas. Nenhuma alteração de schema, dependência ou `.env`.

## Como testar

1. Usar a conta existente com papel **`moderador`** ou **`administrador`**, ativa e com e-mail verificado. Não é necessário criar outra conta.
2. Decisão atualizada em 16/10/2026: ambos os papéis acessam todas as áreas/APIs implementadas do painel. A mudança vale para todos os moderadores, não apenas para uma conta específica.
3. Reiniciar o servidor com `npm start` e entrar com essa conta. Não há alteração de papel ou senha no banco.
4. Abrir `/adm`: conferir indicadores, fila atual, atividade recente, categorias e últimos 14 dias. Dias sem relatos devem mostrar zero. Os atalhos da fila levam ao fluxo de moderação já existente; não aprovam/rejeitam sem revisão.
5. Abrir `/adm/usuarios`: testar busca, filtros e paginação. Os totais dos cards são da base completa; o rodapé conta somente o filtro atual.
6. Para testar bloqueio, usar uma **conta de teste de cidadão**, não a única conta de trabalho do grupo. Cancelar a confirmação primeiro. Confirmar depois, atualizar a página e verificar o estado. Uma requisição privada dessa conta enquanto bloqueada deve perder o acesso. Desbloquear ao terminar o teste; se a sessão foi encerrada, entrar novamente. O desbloqueio não verifica e-mail e não muda papel/senha.
7. Entrar como moderador: `/adm/moderacao`, `/adm`, `/adm/usuarios`, `/adm/investimentos` e `/adm/relatorios` devem abrir. `/adm/relatos` redireciona à consulta real de moderação. Entrar como cidadão deve manter acesso restrito a todas essas áreas. Investimentos e outros relatórios continuam pendentes; o CSV de relatos já está conectado, conforme o documento acima.

O agente não criou/promoveu contas, não bloqueou/desbloqueou usuários reais e não enviou e-mail neste bloco.

## APIs e estrutura

- `router-adm.js`: aplica autenticação atual, e-mail verificado e papel mínimo moderador; escritas também exigem CSRF/JSON.
- `adminControllers.js`: valida filtros, paginação, UUID e status; a identidade do operador (moderador/administrador) vem exclusivamente da sessão.
- `adminModel.js`: consultas MySQL e regras de bloqueio/auditoria. Nenhum hash de senha ou ID interno é exposto na listagem.
- `periodosAdmin.js`: mês, semanas e dias civis de São Paulo, independentemente do fuso do servidor.
- `adm-usuarios.js` e `adm-dashboard.js`: consultam as APIs e preenchem os componentes existentes, com estados de erro/vazio e sem sucesso simulado.

### Usuários

`GET /api/adm/usuarios?busca=Ana&status=ativo&papel=cidadao&pagina=1&limite=20`

Busca textual até 100 caracteres (nome, sobrenome, e-mail, papel ou UUID exato); `%` e `_` não viram curingas. Status: `ativo` (verificado), `pendente` (ativo sem verificação), `bloqueado`, `inativo`. Papel: `cidadao`, `moderador`, `administrador`. Página de 1 a 10000; limite de 1 a 50. Omitir filtros consulta todos os usuários não excluídos.

Resposta: `{usuarios, resumo, paginacao, csrfToken}`. Cada usuário contém `{publicId,nome,sobrenome,email,papel,status,emailVerificado,criadoEm,relatos,podeAlterarStatus}`. Datas da API são instantes; a tela apresenta horário de São Paulo.

`PATCH /api/adm/usuarios/:publicId/status`

Cabeçalhos: `Content-Type: application/json` e `X-CSRF-Token` recebido no GET. Corpo: `{ "statusAnterior": "ativo", "status": "bloqueado" }` (ou o inverso).

Resposta: `{ok,publicId,status,emailVerificado,mensagem}`. Não altera papel, senha nem verificação. Não aceita a própria conta ou contas de administrador como alvo, nem reativa contas inativas. Conta excluída/indisponível: 404; status concorrente conflitante: 409; ator sem permissão: 403. Repetir o mesmo estado é idempotente e não duplica o log. Erros de validação: 422; ausência de JSON: 415. Escritas e auditoria estão na mesma transação; falha da auditoria reverte o status. A permissão atual do operador é conferida novamente no banco dentro da transação; moderador e administrador são aceitos.

O bloqueio é consultado no banco em cada acesso privado. Não significa apagar retroativamente todo cookie de sessão existente: um cookie que nunca acessou uma rota durante o bloqueio pode voltar a funcionar após desbloqueio, dentro da validade normal. Revogação permanente de todas as sessões exige controle adicional de sessões/versão de autenticação.

### Dashboard

`GET /api/adm/dashboard` retorna `{resumo,fila,dias,totalPeriodo,categorias,atividades,atualizadoEm,fuso}`.

- `relatosAtivos`: abertos/em andamento não excluídos, inclusive não publicados.
- `pendentes`: versão atual sem decisão de moderação; fila exibe os cinco mais antigos.
- `aprovadosMes`/`rejeitadosMes`: decisão mais recente da versão atual, tomada no mês civil de São Paulo. Não é contagem de todo o histórico de decisões.
- `cidadesComRelatos`: cidades distintas de relatos não excluídos (não mede atendimento/cobertura do serviço).
- `dias`: 14 datas incluindo hoje, zero quando não há registro; hoje termina no instante da consulta.
- `categorias`: todos os relatos não excluídos agrupados por categoria, não apenas os últimos 14 dias.
- `atividades`: seis eventos recentes de criação de relato, moderação da versão atual e cadastro; não inventa exportações/notificações.

Cada GET consulta um snapshot somente leitura para manter seus totais coerentes. A atualização ocorre ao abrir/reconsultar a tela, não em tempo real. Respostas privadas e as duas páginas usam `Cache-Control: no-store`.

## Verificação e limites

**258 testes passaram**, sendo 29 novos: models/transações e rollback, HTTP com sessão e CSRF, permissões atualizadas, filtros, EJS escapado, paginação, erro de rede, clique duplo e JavaScript em DOM simulado. Não são testes visuais de navegador nem gravações no banco real. O MySQL real foi consultado somente em leitura: ambas as consultas do painel e as colunas da auditoria funcionaram.

Base didática: PSW3_003 (MVC), PSW3_005 (autenticação/autorização) e PSW2_016 (pool MySQL). Complementos: [OWASP — Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) e [MySQL — Consistent Nonlocking Reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-consistent-read.html).

Antes de produção, permanecem os preparativos gerais do projeto, incluindo armazenamento persistente de sessões, revisão dos limites de tentativas e configuração segura de produção. Este bloco não declara todo o backend concluído.
