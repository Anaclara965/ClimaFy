# Ranking — API e importação

Implementado e importado com autorização em **16/10/2026**. A página, CSS e JavaScript existentes **não foram alterados**. O front deve trocar a leitura/cálculo dos CSVs pela API; a tela antiga ainda usa a lógica anterior até essa conexão.

## API para o front

Reiniciar com `npm start` e abrir `/api/ranking`. Exemplos:

- `/api/ranking?periodo=7d`
- `/api/ranking?periodo=30d&busca=pinheiros`
- `/api/ranking?periodo=90d&ordem=orcamento`

GET público somente leitura, sem cookie/CSRF obrigatório. Filtros opcionais: `periodo=ano|7d|30d|90d` (padrão `ano`), `busca` textual até 100 caracteres, `ordem=prioridade|orcamento` (padrão `prioridade`). Filtros desconhecidos/repetidos/estruturados ou tentativa de enviar pesos/ano: 422. Ausência de publicação ou inconsistência: 503 com `codigo: "RANKING_INDISPONIVEL"`, nunca dados fictícios. Falha interna: 500 genérico. `Cache-Control: no-store`.

Resposta:

- `ranking`: `nome`, `slug`, `previsto`, `realizado`, `execucao`, `ocorrencias`, `indice`, `classificacao`, `tom`, `valorPorOcorrencia`, `posicao`.
- `resumo`: `areasMonitoradas`, `ocorrencias`, `areasComOcorrencias`, `orcamentoRealizado` do período inteiro, independentemente da busca.
- `filtros`, `atualizadoEm` (publicação UTC no banco, **não atualização externa da fonte**), `metodologia` (ano, pesos, versão, início/referência e avisos) e `fontes` (nomes dos arquivos locais, hashes e quantidades, sem caminho interno/operador).

Valores monetários em reais; percentual original preservado. `valorPorOcorrencia` é `null` sem ocorrências. `posicao` é a posição global por prioridade; busca/ordem de orçamento não a renumeram nem recalculam os pesos. Empates completos mantêm a ordem original do orçamento.

```js
const resposta = await fetch('/api/ranking?periodo=30d', {
  headers: { Accept: 'application/json' }
});
const dados = await resposta.json();
if (!resposta.ok) throw new Error(dados.erro || 'Falha ao consultar ranking.');
// Usar dados.ranking e dados.resumo nos componentes existentes.
```

O front deve tratar lista vazia/erro, ignorar respostas antigas ao trocar filtros rapidamente, inserir nomes via `textContent` (não HTML/SVG interpolado) e mostrar a data real de referência. Nenhuma página nova é necessária.

## Fórmula aprovada `65-35-v1`

```
normalizadas = ocorrenciasDaRegiao / max(1, maiorQuantidade)
deficit = (maiorRealizado - realizadoDaRegiao) / max(1, maiorRealizado - menorRealizado)
indice = round((normalizadas * 0.65 + deficit * 0.35) * 100)
```

Sem ocorrência, índice zero. Classificações preservadas: ≥75 Crítica; ≥50 Alta; ≥25 Média; demais Baixa. Déficit é diferença relativa para a região de maior valor realizado, **não** previsto menos executado. Não inclui relatos/votos de usuários, população ou gravidade.

É um índice comparativo do projeto, **não alerta oficial nem comprovação de efeito do investimento**. Os CSVs são locais, rotulados como Defesa Civil/GeoSampa/orçamento; autenticidade, licença e atualização externa não foram certificadas. URLs/licenças não foram inventadas para as fontes.

## Datas e resultado conferido

As 192 ocorrências foram preservadas: 191 de 2026 e uma de 2025. A anual usa só 2026, conforme autorização. A referência é **26/06/2026**, última ocorrência do ano no conjunto. As janelas de 7/30/90 dias terminam nessa data, com limites inclusivos e sem atravessar o início do ano; não são relativas a hoje. Contagens: ano **191**, 7 dias **10**, 30 dias **10**, 90 dias **15**, sempre 32 regiões. O orçamento anual é o mesmo nas quatro janelas, sem distribuição temporal/territorial inventada.

Seis valores tinham ruído decimal, como `28303044.830000002`: arredondados em centavos com aritmética inteira para DECIMAL, mantendo a linha original em JSON. Percentuais originais também ficam em JSON; o campo DECIMAL tem duas casas. Coordenadas têm sete casas e não são retornadas nesta API.

## Importação operacional

**Já aplicada no banco compartilhado; não executar reset/schema.** Acrescentados: 2 fontes, 2 lotes concluídos, 192 ocorrências, 32 execuções orçamentárias, 4 snapshots finalizados, 8 vínculos, 128 resultados e 1 log de auditoria. Quantidade/conteúdo dos registros protegidos de contas, relatos, moderações, históricos, votos, revisões, notificações e preferências foram conferidos e preservados.

```bash
npm run dados:validar
npm run dados:importar -- --confirmar=ASSINATURA_DA_PREVIA --operador=UUID_PUBLICO_DO_OPERADOR
```

Sem argumentos, **ambos só validam** os dois arquivos fixos de `DADOS/`. Escrita exige assinatura atual dos arquivos/geografia/fórmula e operador moderador/administrador ativo/verificado, conforme a decisão de acesso completo ao painel. Não passar senha ou `.env` no comando. Não há upload ou endpoint público de importação.

O importador valida UTF-8, limite de 10 MiB/arquivo e 100 mil linhas, cabeçalhos/aspas/colunas, datas/coordenadas, IDs duplicados e correspondência/cobertura das regiões. Não descarta linhas silenciosamente, converte erro em zero ou inventa distritos/bairros. Trava, lotes, dados, snapshots e auditoria estão na mesma transação, sem DDL. Repetir os mesmos hashes concluídos não duplica dados (conferido no MySQL real). Arquivo diferente, lote parcial ou dados prévios incompatíveis são recusados, **não sobrescritos**. Este importador inicial não substitui a futura política de atualização das fontes.

## Estrutura e testes

`csvEntrada.js`/`prepararDadosRanking.js`: parsing e prévia; `ranking.js`: cálculo puro; `importacaoRankingModel.js`/`database/importar-ranking.js`: importação; `rankingModel.js`: último snapshot finalizado e lotes, em transação somente leitura; `rankingControllers.js`: validação pública. A consulta confere correspondência com a publicação e recusa dados alterados/inconsistentes.

**333 testes passaram**, incluindo comparação com o JS anterior nos quatro períodos, parsing/precisão, assinatura, permissão, rollback/auditoria, idempotência, snapshots, filtros e HTTP. Também houve importação autorizada e consultas reais das quatro janelas, com repetição sem duplicação. Nenhum teste visual da tela foi feito; o front ainda precisa conectar a API. Sem migração, dependência, `.env`, página, CSS ou JS de navegador novos/alterados; `package.json` recebeu apenas os dois atalhos operacionais.

Base didática: MVC, validação, integração MySQL/pool e consumo de APIs dos materiais PSW, reaproveitando schema e fórmula existentes.
