# API de investimentos/orçamento — contrato técnico

Backend de consulta implementado em **16/10/2026**. O conteúdo é **orçamento anual por subprefeitura**, não cadastro de projetos/obras. A tela `/adm/investimentos` e seu JavaScript/CSS permanecem intactos, ainda demonstrativos. O relatório consolidado de dependências do frontend continua reservado para o final do backend, conforme combinado.

## Consulta e acesso

`GET /api/adm/investimentos`

Exige sessão atual de **moderador ou administrador**, conta ativa, e-mail verificado. Visitante: 401; cidadão/papel desconhecido: 403. Consulta somente leitura, sem token CSRF; `Cache-Control: no-store`. Não há POST, PUT, PATCH ou DELETE para alterar valores.

Exemplos, depois de reiniciar o servidor e entrar como equipe:

- `/api/adm/investimentos?limite=50`
- `/api/adm/investimentos?subprefeitura=pinheiros`
- `/api/adm/investimentos?busca=se&ordem=realizado-maior`
- `/api/adm/investimentos?pagina=2&limite=20`

Filtros:

- `ano`: opcional, somente `2026` disponível no conjunto atual; outro ano retorna 422, não orçamento zero.
- `busca`: texto até 100 caracteres, normalizado sem acentos, com aliases do ranking; procura nome da subprefeitura/órgão.
- `subprefeitura`: slug fornecido em `opcoes.subprefeituras`; vazio/omitido = todas. Slug bem formado sem correspondência retorna lista vazia.
- `ordem`: `nome` (padrão), `realizado-maior`, `realizado-menor`, `execucao-maior`.
- `pagina`: 1 a 10000, padrão 1. `limite`: 1 a 50, padrão 20.

Filtros desconhecidos, repetidos/estruturados ou inválidos: 422. Não enviar `usuarioId`, `status`, projeto ou progresso físico. Não são dados/controladores desta API.

## Resposta

- `orcamentos`: página de registros com `slug`, `subprefeitura`, `cidade`, `uf`, `orgao`, `ano`, `previsto`, `atualizado`, `congelado`, `descongelado`, `realizado`, `execucaoInformada`.
- `resumo`: totais do conjunto anual completo.
- `resumoFiltrado`: totais depois dos filtros, **antes da paginação**.
- `paginacao`: `pagina`, `limite`, `total`, `paginas`.
- `filtros`: parâmetros normalizados. `opcoes`: anos disponíveis e catálogo de slugs/nomes/cidades do conjunto, sem IDs internos.
- `publicadoEm`: publicação UTC no sistema, não data de atualização externa da fonte.
- `fonte`: nome local, arquivo, SHA-256, linhas e `dataAtualizacaoExterna: null` (o CSV não informa essa data).
- `metodologia`: moeda/unidades, definição dos percentuais e limites de escopo/atualidade.

Todos os campos monetários são **strings decimais em reais, com duas casas**, incluindo os totais. Exemplo: `"30835429.95"`, e não centavos inteiros nem texto formatado `R$`. Essa escolha evita perda de precisão ao somar. Formatar para apresentação sem recalcular os totais no navegador.

Os dois resumos têm `subprefeituras`, os cinco campos monetários e `execucaoSobrePrevisto`:

- `execucaoInformada`: número percentual da linha original do CSV, com sua precisão, não recalculado; não é porcentagem de obra concluída.
- `execucaoSobrePrevisto`: string percentual com duas casas, calculada por **soma realizada / soma prevista × 100**, arredondada em centavos percentuais. Não é média simples dos percentuais nem percentual sobre o orçamento atualizado. Pode superar 100; com previsto zero é `null`, não infinito/zero inventado.
- Sem resultado no filtro: `orcamentos: []`, valores filtrados `"0.00"`, quantidade zero e percentual `null`; o resumo global continua válido. Uma página fora do intervalo não altera os resumos.

Não há nome de projeto, cronograma de obra, status planejado/concluído, contrato ou botão de edição funcional neste contrato. A API não inventa esses dados a partir do percentual financeiro. O CSV de execução de investimentos e os demais relatórios desabilitados também não foram implementados neste bloco.

## Fonte e consistência

Consulta o **único lote orçamentário concluído ligado ao último snapshot anual finalizado de 2026**, o mesmo conjunto usado pelo ranking. Não soma lotes anuais sobrepostos nem mistura rascunhos/importações incompletas. Snapshot, lote, linhas, opções e totais são consultados em uma transação somente leitura.

Ausência de publicação, múltiplos lotes, regiões duplicadas/ausentes, quantidade inconsistente ou valores monetários/percentuais inválidos retornam **503** com `codigo: "ORCAMENTO_INDISPONIVEL"`. Falha inesperada retorna 500 genérico, sem SQL. Não há fallback demonstrativo ou conversão de dado inválido em zero.

Valores são somados e ordenados em centavos com `BigInt`. Nunca retorna BigInt diretamente no JSON. As linhas originais e os valores DECIMAL importados anteriormente não são alterados. Autenticidade, licença e atualização externa do arquivo não foram certificadas; o timestamp de publicação não torna esses valores atuais/em tempo real. Novas edições dos arquivos continuam dependendo de revisão da política de importação, não de edição manual por esta API.

## Exemplo mínimo de consumo

```js
const resposta = await fetch('/api/adm/investimentos?subprefeitura=pinheiros', {
  credentials: 'same-origin', headers: { Accept: 'application/json' }
});
const dados = await resposta.json();
if (!resposta.ok) throw new Error(dados.erro || 'Falha ao consultar orçamento.');
// dados.orcamentos: linhas; dados.resumo/resumoFiltrado: cards; dados.opcoes: filtros.
```

Tratar sessão expirada/403/503, lista vazia e paginação. Nomes devem ser apresentados como texto, sem HTML interpolado. Não armazenar dados privados em cache público. Ao trocar filtros, ignorar respostas antigas e voltar à primeira página. A ligação visual ficará com o frontend; não foi criado componente novo neste bloco.

## Estrutura e verificação

`router-adm.js` aplica sessão/e-mail/papel → `investimentoControllers.js` valida → `investimentoModel.js` consulta → `orcamento.js` soma/formata em centavos.

**351 testes passaram**, incluindo 18 novos de models/HTTP: precisão acima do limite inteiro do Number, percentual ponderado/zero, snapshot/lote, filtros, paginação, ordenação, acesso atualizado, inexistência de escrita e erros seguros. Sessões/model do HTTP são simulados; não é validação visual do painel.

Conferência adicional no MySQL real somente leitura: 32 regiões, 12 linhas na página 2, um resultado em Pinheiros, busca vazia e totais conferindo com a soma das 32 linhas. Realizado `"839917281.15"`; previsto `"2254753453.00"`; percentual agregado sobre o previsto `"37.25"`. Nenhum dado/schema, `.env`, dependência, página, CSS ou JavaScript de navegador alterado neste bloco. Base didática: MVC, validação, sessões/autorização e MySQL dos materiais PSW.
