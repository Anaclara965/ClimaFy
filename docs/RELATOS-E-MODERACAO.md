# Relatos: envio, revisão e publicação

## Situação atual da tela pública — lista principal conectada em 15/10/2026

Após a reversão anterior, foi autorizada SOMENTE a conexão da lista principal de cards à API `/api/relatos`. Apenas o JavaScript `relatos.js` foi ajustado: EJS, CSS, classes dos cards e layout existentes foram preservados. A busca, os filtros e a paginação dessa lista usam o contrato da API; dados recebidos são inseridos com textContent, sem interpretar HTML. Há estados de carregamento, lista vazia, erro e tentativa novamente. Não foi adicionado mapa nem criada página. Meus relatos, banco e moderação não foram alterados nessa integração.

Os outros blocos (indicadores gerais, destaques, depoimentos e concentração por bairro) continuam exatamente como no protótipo, incluindo seus dados de demonstração. Os dados reais desta etapa são SOMENTE os da lista principal e seu contador. As descrições da integração mais ampla abaixo são históricas e não significam que esses outros blocos foram reconectados. Nova integração ou mudança visual deve ser combinada com o time de frontend.

## Implementado neste bloco (02/10/2026)

- Envio autenticado com validações e gravação de relato + histórico na mesma transação.
- `/meus-relatos`: lista privada, inclusive pendentes e rejeitados. Os detalhes privados exigem autoria; não basta conhecer o UUID.
- `/adm/moderacao`: fila real para moderador/administrador, com busca, filtros, paginação, aprovação, rejeição e solicitação de ajuste.
- `/adm/relatos` redireciona o administrador para a mesma fila no filtro Todos; a antiga tela de demonstração foi preservada no projeto, mas não é mais usada nessa rota.
- Situação do problema alterada nos detalhes da moderação, com histórico e data de resolução. Reabrir limpa a data de resolução.
- `/relatos`: consulta pública real nos cards e blocos originais, com filtros, contadores, paginação, destaques e concentração por bairro. A pedido do responsável, o mapa inserido na listagem foi retirado; a estrutura original do front foi restaurada. Não foram criadas páginas novas nessa correção; Meus relatos ficou intacto.
- `/relatos/:publicId`: detalhes públicos e ponto no mapa; pendentes/rejeitados/excluídos retornam 404.

Todas as consultas públicas usam `vw_relatos_publicos`: somente a última decisão aprovada **da versão atual do conteúdo** publica o relato. Aprovar NÃO resolve o problema. Rejeitar NÃO muda a situação.

## Contrato das APIs

| Método / rota | Entrada / acesso | Resposta |
| --- | --- | --- |
| GET `/api/relatos` | Pública; pagina (1+), limite (1–50), busca (100), status, categoria, bairro (ID), dias (1/7/30), ordem (recent/oldest/votes) | `{relatos, paginacao, resumo, filtros, destaques, porBairro}` |
| GET `/api/relatos/:publicId` | Pública; UUID publicado | `{relato}` ou 404 |
| GET `/api/meus-relatos` | Sessão ativa/verificada; filtros da listagem | `{relatos, paginacao}`; autor sempre vem da sessão |
| GET `/api/adm/relatos` | Moderador/admin; pagina, limite, busca, ordem (oldest/newest), decisao (pendente/todos/aprovado/rejeitado/solicitado_ajuste) | `{relatos, paginacao, resumo, motivos, csrfToken}` |
| GET `/api/meus-relatos/:publicId` | Somente autor | `{relato, csrfToken}` |
| PUT `/api/meus-relatos/:publicId` | Somente autor; JSON com campos do envio + `versao`, CSRF | `{ok, publicId, versao, status, alterado, publicado, mensagem}` |
| DELETE `/api/meus-relatos/:publicId` | Somente autor; JSON `{versao}`, CSRF | `{ok, publicId, excluido, mensagem}` |
| POST `/api/adm/relatos/:publicId/moderacao` | JSON `{decisao, revisao, versao, motivo?, observacao?}`; motivo obrigatório para rejeitar/pedir ajuste | 200 `{ok, mensagem}` |
| PATCH `/api/adm/relatos/:publicId/situacao` | JSON `{status, statusAnterior, versao, observacao?}` | 200 `{ok, mensagem}` |

`status`: aberto, em_andamento ou resolvido. Observação: até 255 caracteres.
`revisao`: string do identificador da última decisão da versão atual, ou `"0"` quando essa versão ainda não foi revisada. `versao`: string positiva do conteúdo consultado. O navegador deve enviar ambos os valores consultados, não inventá-los.
`motivo`: código ativo do catálogo retornado pela API, não o texto do select.
As ações administrativas exigem `X-CSRF-Token`, recebido na consulta da fila ou no HTML dos detalhes. A sessão fornece o moderador; campos extras não escolhem a identidade.

Erros: 400/422 entrada inválida, 401 sem sessão válida, 403 sem papel/token, 404 indisponível, 409 revisão/situação alterada por outra pessoa, 415 formato errado, 500 inesperado. Front mostra mensagens usando textContent e nunca anuncia sucesso antes da resposta. Não reenviar automaticamente após falha de conexão: atualizar a consulta para conferir o resultado.

## Banco: atualização aplicada

No diagnóstico, `relatos` e `historico_status_relato` estavam vazios, mas ainda usavam os estados legados; a view pública não existia. Com autorização do responsável, foi executado `node database/migrate-relatos.js`. Foram alinhados os ENUMs e criada a view. Nenhum registro foi apagado e nenhum usuário foi promovido.

O script também está disponível por `npm run db:migrate:relatos`. Ele não chama apply-schema nem usa DROP. Se encontrar tabelas legadas com registros, para antes dos ALTERs para o grupo planejar a conversão. DDL no MySQL faz commit implícito: execute com o servidor parado em futuras instalações. As operações podem ser retomadas se houver uma falha parcial. Não use `db:schema`/`db:reset` no banco do grupo: esses comandos apagam o schema.

## Teste manual: sua parte

1. Reinicie com `npm start` e entre com sua conta comum.
2. Em `/new-report`, use um bairro cadastrado, marque o ponto e envie um relato claramente identificado como TESTE.
3. Confira em `/meus-relatos`: deve estar aberto e aguardando moderação. Como visitante, seu UUID ainda deve retornar 404 em `/relatos/:publicId`.
4. Com uma conta autorizada de moderador/admin, abra `/adm/moderacao` e aprove o teste. Ele deve aparecer nos cards de `/relatos`. A situação continua Aberto.
5. Nos detalhes da moderação, mude a situação para Resolvido. Isso deve aparecer na consulta pública sem alterar a decisão de aprovação.
6. Na aba Aprovados, rejeite com um motivo. O relato desaparece do público, mas continua disponível ao autor e à equipe; a situação não muda.

Se não houver conta de equipe, um responsável pode criá-la pelo script interativo existente `npm run criar-usuario`. Não coloque senhas no comando/histórico nem promova contas diretamente pelo navegador. O cadastro público continua criando cidadão.

## Verificação feita

- 107 testes Node passaram, incluindo permissões, SQL parametrizado, autoria, CSRF, revisão concorrente, rollback do histórico e os dados dos blocos restaurados.
- Consultas das APIs/model foram conferidas em modo somente leitura no MySQL real.
- No navegador, com sessão/rotas/controller/validações reais e models simulados, foi testado envio → consulta privada → aprovação → mapa/listagem pública → resolução → rejeição/ocultação. Leaflet real usado nos mapas; conteúdo HTML malicioso apareceu como texto, sem execução.
- Não foram criadas contas nem ocorrências de teste no banco real. A validação da gravação real pelo usuário segue o roteiro acima.

Na correção de layout também foi conferido no navegador: ausência de mapa/Leaflet na listagem, cards com as classes/cores anteriores, todos os blocos originais visíveis, destaques/concentração usando a API e acompanhamento/moderação funcionando. Os depoimentos estáticos do front foram preservados; tempo médio e taxa de aprovação ficam com “—” enquanto não tiverem cálculo definido. Destaques usam os dois publicados mais votados; concentração conta relatos abertos publicados, sem inventar uma classificação de risco. Esses dois blocos consideram toda a base pública, não somente a página ou a busca atual.

## Ainda fora deste bloco

Upload de fotos continua pendente. Ranking calculado/importado e sua API foram implementados em 16/10/2026 (`docs/RANKING-API.md`); conectar a página antiga fica com o front. Notificações internas do autor foram implementadas no backend em 16/10/2026 (README 10.13 e `docs/NOTIFICACOES-API.md`); a interface fica com o time do front. Voto/remoção de voto e edição/exclusão pelo autor foram implementados em 15/10/2026 (README 10.8/10.9). Solicitar ajuste registra o motivo; o autor corrige pelo formulário existente, gerando nova versão pendente. O mapa e os cards da HOME ainda são um protótipo separado; os dados reais deste bloco estão em `/relatos`.

CSRF foi incluído nas novas ações de moderação/situação. Isso não substitui a revisão geral de segurança antes da publicação (sessões persistentes, rate limiting e demais ações privadas).

## Estrutura para estudar

Rotas conectam sessão/permissão → validação → controller → model. `relatoModel.js` cria; `relatoConsultaModel.js` consulta; `moderacaoModel.js` revisa/atualiza com transações. A UI usa fetch e só confirma ações após o servidor. São os mesmos conceitos de MVC, validação, sessão/autorização e integração MySQL que estamos praticando.
