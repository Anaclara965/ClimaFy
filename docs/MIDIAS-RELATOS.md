# Foto e vídeo de relatos — backend

## Estado desta entrega

Backend preparado em 16/10/2026, com armazenamento Cloudinary e testes simulados.
Sem credenciais não há upload real; o servidor e o cadastro de relatos sem anexo
continuam funcionando. Nenhuma conta, arquivo real ou registro do MySQL foi
alterado pelo agente neste bloco. Não foi executada migração/reset.

**Integração das telas existentes acrescentada em 16/10/2026:** o campo de
`/new-report` consulta configuração/CSRF e permite selecionar ou arrastar um
anexo, remover a seleção e enviar multipart. Criação sem arquivo e edição
continuam JSON. A edição não troca arquivos existentes. Detalhes público/do
autor/da moderação carregam a mídia por suas respectivas APIs. A tabela da
moderação tem link “Consultar anexos”, não mais a indicação fixa “Sem upload”.
Não foi criada página nem alterado arquivo CSS: somente integração EJS/JS nas
telas existentes, com mídia limitada à largura do conteúdo.
O relatório consolidado do frontend continua reservado para o final.

Verificação real de 16/10: tabela `relato_midias`, limite de 5 MiB, suporte aos
tipos de vídeo e consulta via view conferidos no MySQL somente em leitura.
Após correção das credenciais pelo responsável, autenticação, upload e leitura
protegida de uma pequena imagem técnica foram confirmados no Cloudinary; somente
esse arquivo temporário foi removido, sem criar relato no MySQL. Ainda falta
conferir o fluxo completo pela tela e testar vídeo real com o responsável.
Não confundir configuração preenchida com autenticação confirmada.

### Prévia local da foto antes do envio

O campo existente mostra a foto selecionada ou arrastada em uma caixa de até
160 × 160 pixels, sem recortar/deformar o conteúdo (`object-fit: contain`).
O arquivo original é mantido para upload: a miniatura não comprime a imagem,
não altera os bytes e não faz upload ao selecionar. Nome via texto, não HTML.
Remover/trocar seleção limpa a prévia e libera a URL local; saída da página
também libera a referência. Retorno pelo histórico recria a prévia quando há
seleção preservada. Erro de leitura da imagem pede outra seleção; eventos
atrasados de uma miniatura antiga não removem a nova. Vídeos continuam sem
miniatura local neste passo, com o envio já existente preservado.

**413 testes passaram**, com cinco novos casos de prévia em DOM simulado.
Não substituem checagem visual no navegador. Sem mudança de banco, `.env`,
dependência, página nova ou arquivo CSS neste ajuste. Base técnica:
[MDN — createObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
e [revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static).

## Limites da primeira versão

- Um anexo opcional, **somente ao criar relato novo**. Não há endpoint para
  acrescentar/substituir/excluir anexo de relato existente: isso exigiria nova
  versão e histórico de mídia, sem herdar aprovação de conteúdo anterior.
- JPEG/PNG para foto e MP4/WebM para vídeo; até **5 MiB (5.242.880 bytes)**,
  respeitando o limite atual de `relato_midias` no schema do projeto.
- Vídeos precisam ter imagem, duração maior que zero e até **30 segundos**;
  dimensões válidas e até 40 milhões de pixels. O tamanho pode exigir compressão
  de vídeos gravados pelo celular. HEIC, GIF, SVG, PDF e outros formatos não entram.
- Triagem de assinatura binária e MIME; extensão/nome original não decidem
  aceitação nem caminho. Cloudinary precisa decodificar e confirmar formato,
  tamanho processado, dimensões e duração. Triagem não equivale a antivírus.
- Imagens têm transformação de remoção de perfil/metadados (`strip_profile`).
  Vídeo não tem promessa de remoção integral de metadados. Não enviar material
  com rostos/documentos/dados sensíveis sem necessidade e autorização.

## Configuração (não enviar valores ao chat/GitHub)

No `.env` local, e depois nas variáveis de ambiente do serviço Render:

```dotenv
CLOUDINARY_CLOUD_NAME=preencha_no_seu_ambiente
CLOUDINARY_API_KEY=preencha_no_seu_ambiente
CLOUDINARY_API_SECRET=preencha_no_seu_ambiente
```

`cloudinary` foi acrescentado ao `package.json`; executar `npm install` após
atualizar o checkout. Nenhuma mudança de senha/chave antiga é necessária.
Não habilitar upload unsigned nem colocar segredo em `app/public`/EJS.
O envio assinado é feito pelo backend, com `type: authenticated`, UUID gerado
no servidor, sem sobrescrita e sem pasta local de uploads no Render.

Valores ausentes retornam `disponivel: false` na configuração e **503** para
multipart. Valores preenchidos não comprovam conexão, permissão ou cota: o teste
real de ponta a ponta continua obrigatório quando o acesso ao Cloudinary voltar.

## Endpoints

### Configuração e envio

`GET /api/relatos/envio/configuracao` — sessão ativa/verificada, papel cidadão
ou superior, `Cache-Control: no-store`. Responde:

```json
{
  "csrfToken": "token_da_sessao",
  "anexos": {
    "disponivel": false,
    "campo": "foto",
    "quantidade": 1,
    "tamanhoMaximoBytes": 5242880,
    "duracaoMaximaVideoSegundos": 30,
    "tipos": ["image/jpeg", "image/png", "video/mp4", "video/webm"],
    "somenteNaCriacao": true
  }
}
```

`POST /api/relatos` com anexo recebe `multipart/form-data`, os mesmos oito campos
do relato e um arquivo no campo **`foto`** (também para vídeo, por compatibilidade
com o input existente). O header **`X-CSRF-Token`** é obrigatório e conferido
antes de iniciar o parser/upload. Não enviar o token como campo do multipart.
Cada campo textual só pode aparecer uma vez. Até 10 campos, 2 KiB cada.

Exemplo para futura integração, sem alterar layout:

```javascript
const respostaConfig = await fetch('/api/relatos/envio/configuracao', {
  headers: { Accept: 'application/json' }, credentials: 'same-origin'
});
if (!respostaConfig.ok) throw new Error('Não foi possível preparar o envio.');
const config = await respostaConfig.json();
if (!config.anexos.disponivel) throw new Error('Anexos indisponíveis.');
const dados = new FormData();
for (const campo of ['titulo', 'descricao', 'categoria', 'severidade',
  'bairro', 'latitude', 'longitude', 'referencia']) {
  dados.set(campo, valores[campo] ?? '');
}
dados.set('foto', arquivoSelecionado);
const resposta = await fetch('/api/relatos', {
  method: 'POST', credentials: 'same-origin',
  headers: { Accept: 'application/json', 'X-CSRF-Token': config.csrfToken },
  body: dados
}); // Não definir Content-Type: o navegador acrescenta o boundary.
const corpo = await resposta.json();
if (!resposta.ok) throw new Error(corpo.erro ?? corpo.erros?.join(' ') ?? 'Envio recusado.');
// Confirmar somente se status 201, corpo.ok === true e publicId válido.
```

Retorno de criação mantém o contrato anterior: `201`, `ok`, `publicId`,
`status: aberto`, `publicado: false`. Não revela URL remota, segredo ou chave de
armazenamento. A criação JSON sem arquivo permanece compatível. **Esse fluxo
JSON legado ainda não exige CSRF; não foi considerada concluída a revisão ampla
de CSRF do app.** Edição continua aceitando somente JSON com seu CSRF anterior.

### Consulta e conteúdo

| Uso | Listagem | Arquivo |
| --- | --- | --- |
| Público, só versão atualmente aprovada | `/api/relatos/:publicId/midias` | `/api/relatos/:publicId/midias/:id` |
| Próprio autor, inclusive pendente | `/api/meus-relatos/:publicId/midias` | `/api/meus-relatos/:publicId/midias/:id` |
| Moderador/administrador | `/api/adm/relatos/:publicId/midias` | `/api/adm/relatos/:publicId/midias/:id` |

Listagem devolve `{midias: [{id, tipo, mimeType, tamanhoBytes, url}]}`. ID de mídia
é texto; usar a URL relativa retornada, nunca construir endereço do Cloudinary.
Relato sem mídia retorna lista vazia; sem acesso/inexistente/excluído retorna 404
(visitante em API privada: 401; cidadão no painel: 403).

O conteúdo passa pelo backend após nova consulta de publicação/autoria. Arquivo
não é redirecionado para URL pública: backend gera download autenticado assinado
com validade de 60 segundos, lê no máximo 5 MiB e devolve somente os bytes.
Essa URL nunca é entregue ao navegador. Todos os acessos têm `no-store` e
`nosniff`; suporte a um intervalo `Range` para vídeo (`206`/`416`). O backend
baixa o arquivo inteiro mesmo para um intervalo: adequado só a este limite
pequeno, não uma solução de streaming de vídeos grandes.

Editar o texto retira publicação pela view da versão atual; o mesmo acontece
com a mídia pública. Excluir relato oculta também o acesso aos anexos. Arquivos
existentes não são destruídos automaticamente, pois o relato usa exclusão
lógica e preserva histórico. Uma transferência já autorizada/em andamento não
pode ser desfeita, assim como uma cópia já salva pelo usuário.

## Consistência, abuso e limites operacionais

Multer usa memória, não disco local; dois pedidos multipart simultâneos por
processo, até 10 pedidos por conta/hora (incluindo inválidos), teto de 5.000
contadores e limpeza de expirados. Downloads têm até quatro leituras externas
simultâneas por processo. Excesso: 429 e `Retry-After`. Não é proteção distribuída;
reinícios zeram contadores e continuam pendentes limites compartilhados e
controle de tráfego na infraestrutura.

Arquivo é enviado antes da transação MySQL. Metadados, relato e primeiro histórico
são inseridos na mesma conexão/transação; falha conhecida tenta remover o objeto
Cloudinary. Timeout de upload, falha de limpeza, rollback impossível ou resposta
perdida ao COMMIT deixam possível arquivo privado para reconciliação manual,
identificado por UUID no aviso de log. Não é transação distribuída nem fila
durável; **não apagar arquivos de commit incerto sem conferir o vínculo no banco**.
Também não repetir automaticamente o POST após resposta perdida; consultar Meus
relatos primeiro. Não há chave de idempotência neste fluxo.

Entrega autenticada via API/proxy custa tráfego no Cloudinary e no Render; cotas
do plano continuam valendo. Não é uma CDN pública ilimitada. Antes de habilitar
no site hospedado: validar upload/download autenticado no plano da conta,
limites/custos, teste real JPEG/PNG/MP4/WebM e apresentação dos anexos na moderação.

## Verificação e referências

Testes: `node --test tests/midiaService.test.js tests/midiaModel.test.js tests/midiaController.test.js`.
Não usam arquivos de usuários, credenciais reais, SMTP ou MySQL/Cloudinary reais.
A assinatura de download usa o SDK real com credenciais fictícias e fetch falso.
O contrato SQL foi baseado no schema do projeto; compatibilidade com a tabela
do banco hospedado foi conferida em leitura em 16/10/2026. Ainda falta o teste
real completo de envio/gravação/moderação/leitura com a conta do responsável.

Base didática: **PSW2_015 — Multer, Path e Fs** (multipart, memória e limites),
**PSW3_003 — MVC**, **PSW3_005 — Autenticação e Autorização** e integração MySQL.
Complementos: [Cloudinary — Node upload](https://cloudinary.com/documentation/node_image_and_video_upload),
[Cloudinary — acesso a mídias](https://cloudinary.com/documentation/control_access_to_media) e
[Render — discos e filesystem efêmero](https://render.com/docs/disks).
