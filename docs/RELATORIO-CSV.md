# Exportação CSV de relatos — 16/10/2026

## Teste manual

1. Reiniciar o servidor com `npm start` e entrar como **moderador ou administrador**, com conta ativa/verificada.
2. Abrir `/adm/relatorios`. No card existente **Relatos por região**, selecionar período de criação, categoria, bairro/cidade e situação.
3. Clicar **Baixar CSV** e abrir o arquivo no Excel/LibreOffice. O formato é UTF-8 com BOM, separador `;`, aspas e linhas CRLF. Na importação manual, selecionar UTF-8 e ponto e vírgula, caso a configuração regional não os reconheça automaticamente.
4. Conferir as dez colunas abaixo e os dados do período. Para conferir um relato antigo, escolher **Todo o histórico**. O período padrão é de 30 dias.
5. Testar uma combinação sem registros: deve baixar um arquivo só com cabeçalho, com aviso explícito. Nenhuma linha de demonstração é criada.
6. Como cidadão, tentar abrir a página/API: acesso negado. Sem sessão, a API retorna 401; a página encaminha ao login.

Sem página nova, dependência ou CSS novo. O card ganhou os controles necessários usando estilos existentes; a distribuição dos cards foi preservada. Os cinco outros relatórios permanecem visíveis, desabilitados e identificados como **Ainda não implementado**, em vez de anunciar arquivos inexistentes. Não há PDF, relatório de investimentos, produtividade de moderação ou engajamento neste bloco.

## Fluxo e arquivos

`adm-relatorios.js` → `router-adm.js` → `relatorioControllers.js` → `relatorioModel.js` → MySQL; o helper `csvRelatos.js` monta o arquivo em memória antes da resposta.

O controller valida filtros e configura o download; o model concentra o SQL. A identidade e a permissão são conferidas pelo guard existente em cada requisição. A página usa o nome/e-mail reais da sessão escapados pelo EJS; esses dados **não entram no CSV**.

## Contrato

`GET /api/adm/relatorios/filtros`

Retorna `{categorias: [{slug,nome}], bairros: [{id,nome,cidade}], limite: 5000}`. Opções vêm dos relatos não excluídos, incluindo categorias/geografia históricas desativadas. Bairros homônimos são diferenciados pela cidade. Os seletores de categoria/bairro não recebem opções fictícias quando não há dados.

`GET /api/adm/relatorios/relatos.csv?dias=30&categoria=alagamento&bairro=85&status=aberto`

- `dias`: `7`, `30` (padrão), `90`, `365` ou `todos`. Intervalo móvel em instantes UTC: de agora menos N dias até agora, sem incluir o instante final. `todos` não exige data inicial. Não é filtro de data da moderação.
- `categoria`: slug com letras minúsculas/números/hífens, até 80 caracteres; vazio/omitido = todas.
- `bairro`: ID inteiro positivo até 4294967295; vazio/omitido = todos. A opção mostra cidade, mas o filtro usa o ID do bairro.
- `status`: `aberto`, `em_andamento` ou `resolvido`; vazio/omitido = todos. Não confundir situação do problema com aprovação de moderação.
- Chaves desconhecidas, filtros repetidos/estruturados e formatos inválidos retornam 422. Valores sintaticamente válidos sem correspondência retornam um CSV vazio.

Sucesso: `text/csv; charset=utf-8`, `Content-Disposition: attachment` com nome gerado pelo servidor, `X-Content-Type-Options: nosniff`, `X-Relatos-Total` e `X-Gerado-Em`. Respostas privadas e a página usam `Cache-Control: no-store`.

Todas as APIs exigem sessão de moderador/administrador, conta ativa e e-mail verificado. São GETs somente leitura: não alteram status, histórico, votos ou contadores de exportação; não exigem token CSRF. Nenhuma URL de arquivo público é criada e nenhum CSV fica armazenado no servidor.

## Conteúdo, limites e segurança

Uma linha por relato não excluído, inclusive pendente/rejeitado/solicitado ajuste. Não é uma exportação pública nem somente dos publicados. Moderação vem da decisão mais recente **da versão atual**, usando a mesma regra do restante do painel. Conteúdo editado ainda não revisado aparece como `pendente`. Ordenação: criação mais recente e ID interno como desempate; ID interno não é exportado.

Colunas: **identificador público do relato, criação UTC, cidade, bairro, categoria, severidade, situação, moderação atual, versão, votos**. Não consulta tabela de usuários nem exporta nome, e-mail, hash, ID do autor, título, descrição, observação, referência, latitude ou longitude. Trata-se de minimização de dados, **não garantia de anonimização**: região e identificador público ainda podem permitir associação a um relato.

O limite é de **5.000 relatos por arquivo**. O SQL pede até 5.001: se ultrapassar, responde 422 pedindo filtros mais específicos, sem iniciar download nem truncar silenciosamente. Uma única consulta obtém as linhas/votos/moderação de forma consistente; não combina páginas em instantes diferentes. Não há streaming parcial ou arquivo temporário. Os limites de frequência compartilhados entre instâncias permanecem como preparação de produção.

Todas as células são envolvidas por aspas e aspas internas são duplicadas. Valores potencialmente interpretados como fórmula recebem prefixo de apóstrofo, inclusive após espaços/controles e nas variantes Unicode previstas. Esse prefixo altera o valor bruto da célula; o CSV foi feito para leitura humana, não para reimportação automática. Não há estratégia universal segura para todo editor, especialmente após salvar/reabrir ou remover escapes; não habilitar conteúdo externo/fórmulas de origem desconhecida. Referência: [OWASP — CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

O navegador não incrementa estatísticas fictícias. Mostra horário e quantidade somente após receber arquivo e metadados válidos. “Download solicitado” não comprova que a pessoa salvou/abriu o arquivo. Clique duplo é bloqueado; falhas preservam os filtros e permitem nova solicitação explícita. Contagens mensais de exportações não foram implementadas.

## Verificação

**284 testes passaram**, incluindo 25 novos para validação, SQL parametrizado, exclusão de dados desnecessários, moderação por versão, limite, CSV/aspas/fórmulas, permissão atual, erros e JavaScript em DOM simulado. Os testes de backend/HTTP usam banco simulado; os de DOM não são inspeção visual nem download real em navegador.

O MySQL real foi consultado somente em leitura: metadados e período padrão funcionaram, com 1 relato na conferência. O CSV foi gerado apenas em memória; nenhum dado real foi alterado e nenhum arquivo real foi salvo pelo agente. Não há migração nem mudança de `.env`.

Base didática: PSW3_003 (MVC), PSW3_005 (autenticação/autorização), PSW2_016 (MySQL/pool), com complemento de segurança da OWASP acima.
