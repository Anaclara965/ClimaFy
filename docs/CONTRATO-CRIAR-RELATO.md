# Criar relato — integração com o frontend

Implementado: POST `/api/relatos`, autenticação por sessão, validações e controller
conectado ao model MySQL. Os testes usam banco simulado; a gravação real ainda
precisa ser conferida com uma conta real. A tela `/new-report` agora envia os dados
via fetch, apresenta erros na própria página e confirma a criação após resposta 201.

## Requisição

Usuário precisa estar logado, ativo e com e-mail verificado. Enviar JSON com
`Content-Type: application/json` usando fetch no mesmo domínio (cookie de sessão).
Sem anexo, esta rota continua recebendo JSON. Foi acrescentado multipart com
CSRF para um anexo opcional na criação; ver [Contrato de mídias](MIDIAS-RELATOS.md).
Não aceita envio tradicional urlencoded do formulário.

| Campo | Conteúdo |
| --- | --- |
| titulo | Texto obrigatório, até 80 caracteres |
| descricao | Texto obrigatório, até 280 caracteres |
| categoria | alagamento, queimada, calor-extremo, arvore-caida, lixo ou poluicao-agua |
| severidade | leve, moderada, grave ou critica |
| bairro | ID inteiro positivo retornado por `/api/bairros`, não o nome |
| latitude | Número entre -90 e 90, do ponto escolhido no mapa |
| longitude | Número entre -180 e 180, do ponto escolhido no mapa |
| referencia | Texto opcional, até 255 caracteres; pode omitir ou enviar vazio |

Latitude/longitude e bairro aceitam números ou strings numéricas. Demais campos
devem ser strings. Autor vem da sessão; cidade vem do bairro no banco. Não enviar
usuarioId, cidadeId, status ou aprovação: o servidor não usa esses campos.

## Respostas

- **201**: `{ "ok": true, "mensagem": "Relato enviado para moderação.", "publicId": "uuid", "status": "aberto", "publicado": false }`.
- **422**: `{ "erros": ["mensagem de validação"] }`. Preservar formulário e mostrar erros.
- **401**: `{ "erro": "mensagem" }`. Solicitar login novamente.
- **403**: `{ "erros": ["mensagem"] }`. Conta não autorizada pelo model.
- **415**: `{ "erros": ["mensagem"] }`. Enviar application/json.
- **500**: `{ "erro": "Erro interno do servidor" }`. Não mostrar sucesso.

O front pode obter mensagens com `corpo.erros ?? [corpo.erro ?? "Não foi possível enviar."]`.
Só mostrar sucesso após `resposta.ok`. Desabilitar o botão enquanto envia e
reativar em finally; não reenviar automaticamente após falha de conexão, pois
o servidor pode ter gravado antes de a conexão cair (a API ainda não é idempotente).

## O que falta integrar

1. Mapa Leaflet, localização atual e busca de endereço já fornecem coordenadas
   reais. Cidade/bairro são sugeridos a partir do ponto, com correspondência no
   cadastro. Veja `MAPA-E-LOCALIZACAO.md` para os limites dessa identificação.
2. Envio via fetch e apresentação de erros já implementados. Os campos ficam
   bloqueados durante a requisição; em caso de erro voltam ao estado anterior.
3. A confirmação exibe o identificador público e avisa que o relato aguarda
   moderação. O acompanhamento está disponível em `/meus-relatos`. Um envio confirmado não pode ser repetido na mesma tela; o link
   "Criar outro relato" abre um formulário novo.
4. Foto/vídeo: campo existente conectado ao backend Cloudinary, com configuração
   e CSRF obtidos antes de habilitar seleção/arraste. Detalhes e moderação exibem
   os anexos. Falta corrigir a autenticação Cloudinary e testar o fluxo real.
   Veja [Mídias dos relatos](MIDIAS-RELATOS.md).

## Conferência manual da gravação real

1. Reinicie o servidor e entre com uma conta ativa e verificada.
2. Abra `/new-report`, preencha título e descrição, escolha localização e confira
   o bairro. Envie uma ocorrência de teste claramente identificada como teste.
3. Espere a confirmação e copie o identificador público exibido. O sucesso indica
   criação, não aprovação/publicação; o relato ainda não aparece na listagem pública.
4. Confira no Workbench, usando o identificador que acabou de receber:

```sql
SELECT public_id, titulo, status, bairro_id, latitude, longitude
FROM relatos
WHERE public_id = 'cole-o-identificador-aqui';
```

O teste da tela automatizado usa sessão, validators e controller reais, com model
simulado para evitar gravação no banco do grupo. Foi conferido bloqueio de envios
repetidos, coordenadas ausentes, erro de validação, erro do model, sessão expirada,
resposta inválida e sucesso com dados normalizados. Não carregue/reset o schema
para fazer esse teste; o banco existente já é usado pela aplicação.

## Limites e próximos blocos do backend

- Validar vínculo geográfico ponto/bairro se essa regra for exigida pelo grupo:
  atualmente verificamos limites mundiais e existência/atividade do bairro, não
  se o ponto está dentro do polígono. Coordenadas ausentes nunca são inventadas.
- Moderação, listagem pública em cards e acompanhamento privado foram
  conectados em 02/10/2026; veja `RELATOS-E-MODERACAO.md`. Votação implementada;
  upload de mídias e integração nas telas existentes preparados em 16/10/2026,
  com autenticação Cloudinary e teste real completo pendentes.
- Revisar proteção CSRF, limites de requisições e persistência de sessões antes
  de produção. Não habilitar CORS permissivo com cookies; multipart de criação
  exige token CSRF, enquanto edição continua exclusivamente JSON com seu token.

## Estrutura para estudar

`router.js` conecta autenticação → JSON ou multipart protegido → validators → controller.
`relatoControllers.js` lê erros, pega campos validados e traduz para o model.
`relatoModel.js` grava relato e histórico na mesma transação, com SQL parametrizado.
Uma conta comum cria um relato aberto, mas ele só aparece publicamente após moderação.
