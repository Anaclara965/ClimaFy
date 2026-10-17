# Notificações internas — contrato para o frontend

Backend implementado em 16/10/2026. Por decisão do responsável, **o front conectará os avisos às telas**: este bloco não adiciona sino, modal, página, CSS ou JavaScript de navegador. Nenhum e-mail é enviado.

## Regras decididas

- Aprovar, rejeitar ou solicitar ajustes gera aviso **para o autor do relato**, não para todos os usuários, seguidores do bairro ou integrantes da equipe.
- Alterar a situação também avisa o autor, inclusive ao reabrir um relato resolvido. Situação idêntica não cria histórico/aviso duplicado.
- Avisos do **próprio relato são imediatos**, independentemente da frequência diária/semanal. A frequência e os horários silenciosos ficam reservados aos **futuros alertas dos bairros**. Esses alertas e seu agendador ainda não estão implementados. O texto da tela de preferências deve ser esclarecido pelo front ao integrar.
- `canal_sistema = 0` impede criar novos avisos; preferência ausente segue o padrão habilitado do schema. A criação também exige autor ativo, não excluído e com e-mail verificado. Desabilitar o canal não apaga o histórico anterior.
- Disponível imediatamente significa persistido para a próxima consulta da API, não push, WebSocket, toast automático ou entrega por e-mail.
- Decisão/situação, histórico correspondente e aviso usam a **mesma transação**. Falha inesperada na gravação do aviso reverte a ação inteira. Canal desativado/destinatário indisponível apenas não gera aviso e não impede a moderação.
- A versão aparece na mensagem: aviso antigo é histórico, não afirma que uma versão editada depois continua aprovada. Nova versão ainda precisa ser revisada. Avisos anteriores permanecem após edição/exclusão lógica do relato.
- Não há preenchimento retroativo: aprovações/alterações anteriores à instalação deste bloco não ganham avisos automaticamente.

## 1. Consultar

`GET /api/notificacoes?pagina=1&limite=10&somenteNaoLidas=0`

Sessão ativa/verificada de cidadão, moderador ou administrador. Visitante: 401; papel desconhecido: 403. Papel/estado são conferidos no banco a cada requisição privada. A identidade vem sempre da sessão; não mandar `usuarioId`.

Filtros opcionais: `pagina` de 1 a 10000 (padrão 1), `limite` de 1 a 50 (padrão 10), `somenteNaoLidas` igual a `0` (todas, padrão) ou `1`. Filtros repetidos, desconhecidos ou inválidos: 422.

Exemplo de resposta (dados ilustrativos):

```json
{
  "notificacoes": [{
    "id": "42",
    "tipo": "relato_aprovado",
    "titulo": "Relato aprovado",
    "mensagem": "A versão 2 do relato \"Rua alagada\" foi aprovada. Consulte Meus relatos para ver os detalhes.",
    "criadaEm": "2026-10-16T18:30:00.000Z",
    "enviadaEm": "2026-10-16T18:30:00.000Z",
    "lidaEm": null,
    "destino": "/meus-relatos"
  }],
  "resumo": { "total": 1, "naoLidas": 1 },
  "paginacao": { "pagina": 1, "limite": 10, "total": 1, "paginas": 1 },
  "csrfToken": "TOKEN_HEXADECIMAL_DE_64_CARACTERES"
}
```

- Lista e contagens usam snapshot consistente, com o mesmo instante de corte obtido do MySQL. Somente notificações já entregues entram na consulta, da mais recente para a mais antiga, com desempate pelo ID.
- `resumo` conta todos os avisos entregues do usuário, independentemente do filtro/página. `paginacao.total` respeita o filtro de não lidas.
- **Consultar não marca como lido.** A lista pode ser vazia, sem itens de demonstração.
- `id` é identificador **da notificação**, não do usuário/relato. É string para preservar BIGINT e segue somente no corpo da marcação, nunca em uma URL. Não converter para `Number`. Conhecer o ID não concede acesso.
- Tipos atuais: `relato_aprovado`, `relato_rejeitado`, `relato_ajuste`, `relato_situacao`. `destino` nesses tipos aponta à página existente `/meus-relatos`, não a uma página nova. Tipos antigos/desconhecidos podem ter destino `null`.

## 2. Marcar um aviso como lido

`PATCH /api/notificacoes/lida`

Cabeçalhos: `Content-Type: application/json` e `X-CSRF-Token` obtido na consulta privada.

Corpo: `{ "id": "42" }` (somente esse campo).

Sucesso: `{ "ok": true, "id": "42", "lidaEm": "2026-10-16T18:32:00.000Z" }`.

Somente o dono consegue marcar o aviso. De outra pessoa, inexistente ou ainda não entregue: **404 com a mesma mensagem**. Não expõe quem é o dono. Repetir a marcação preserva a primeira data de leitura. Transação com trava impede sobrescrita concorrente.

Token ausente/incorreto: 403. Formato diferente de JSON: 415. ID numérico, zero, negativo, fora de BIGINT ou campo inesperado: 422. Falha interna: 500 com mensagem genérica, sem SQL. Respostas da consulta e da marcação usam `Cache-Control: no-store`.

Não há endpoint para o cliente criar avisos, marcar todos de uma vez, apagar notificações ou consultar avisos de outra conta. O GET não possui efeitos de leitura automática; marcar exige ação explícita do usuário.

## Exemplo mínimo para conectar

```js
async function carregarAvisos() {
  const resposta = await fetch('/api/notificacoes', {
    credentials: 'same-origin', headers: { Accept: 'application/json' }
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Falha ao consultar avisos.');
  return dados;
}

async function marcarAvisoLido(id, csrfToken) {
  const resposta = await fetch('/api/notificacoes/lida', {
    method: 'PATCH', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ id })
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Falha ao marcar aviso.');
  return dados;
}
```

Checklist da integração:

- Usar `resumo.naoLidas` no sino; sem dados fictícios ou contagem inferida da página atual.
- Exibir `titulo`/`mensagem` com **`textContent`**, nunca `innerHTML` ou interpolação em HTML/toast. O título de relato pode conter conteúdo digitado pelo usuário.
- Conferir formato da resposta e status. Só anunciar sucesso/alterar o indicador depois da confirmação; bloquear clique duplo. Depois de marcar, consultar novamente e voltar à primeira página se estiver filtrando não lidas. Em falha de rede, consultar o estado antes de repetir uma marcação incerta.
- Tratar 401 como sessão encerrada, sem manter avisos da conta anterior. Limpar conteúdo privado ao sair/trocar de conta. Não guardar avisos/tokens em localStorage/cache público.
- Não marcar todos como lidos ao abrir o sino. Fornecer rótulos acessíveis e feedback (`aria-live`) para a ação individual.
- Datas são UTC no JSON; apresentar no horário de São Paulo. Aceitar lista vazia e opção de tentar novamente. Não declarar “tempo real” sem implementar atualização/push.

## Teste manual

1. Reiniciar o servidor e criar um relato identificado como **TESTE** com conta autenticada.
2. Como moderador, aprovar a versão atual; depois mudar a situação para em andamento/resolvido. Não é necessário alterar um relato importante do grupo.
3. Na sessão da **conta autora**, abrir `/api/notificacoes`: devem aparecer avisos das ações novas. Recarregar não pode marcar como lidos.
4. Usar o cliente HTTP autenticado ou a futura integração do front para enviar PATCH com o ID e o token da própria sessão. Repetir deve manter a data; consultar novamente deve atualizar a quantidade de não lidas.
5. Com outra conta, tentar marcar o mesmo ID usando o token dela: 404. Conta sem sessão deve receber 401.

## Estrutura e verificação

`router.js` aplica sessão/permissão/CSRF → `notificacaoControllers.js` valida e usa identidade da sessão → `notificacaoModel.js` consulta/marca e oferece a função de registro usada por `moderacaoModel.js` **na conexão existente**. Nenhuma migração, dependência, campo de `.env` ou página nova.

**308 testes passaram**, incluindo 24 novos de models/HTTP: dono, CSRF, limites, BIGINT, idempotência, contagens, decisões/situações, canal interno no SQL e rollback. Banco dos testes simulado. A estrutura das duas tabelas foi conferida no MySQL real; listagens com ID de usuário 0 (sem conta correspondente) validaram as consultas sem ler avisos pessoais. Nenhuma notificação real foi criada/marcada e nenhum relato real foi moderado pelo agente. A gravação real e a futura interface devem ser validadas pelo grupo.

Base: MVC, sessões/autorização e MySQL dos materiais PSW. **PSW3_006 — Notificações com simple-notify** aborda a apresentação de mensagens/toasts; não substitui esta persistência privada no banco. A biblioteca existente pode ser usada pelo front depois, observando o tratamento seguro de texto.
