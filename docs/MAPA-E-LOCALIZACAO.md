# Mapa e localização do novo relato

Implementado na tela `/new-report`:

- Clique no mapa, seleção do centro por teclado ou arraste do marcador.
- Botão de localização atual, acionado pela pessoa, com tratamento de permissão,
  indisponibilidade, tempo limite e aviso de precisão aproximada.
- Busca de rua, número e cidade com sugestões de endereço. Use seta para baixo
  para entrar na lista, Enter para escolher e Escape para fechar.
- Identificação de cidade/bairro ao escolher um endereço, usar a localização ou
  ajustar o ponto. A cidade é preenchida automaticamente; o bairro pode ser
  corrigido usando o autocomplete que consulta o banco.

## Como os dados circulam

1. Leaflet guarda latitude/longitude nos campos do formulário.
2. `GET /api/localizacao/endereco?busca=...` consulta endereços no Photon.
3. `POST /api/localizacao/ponto` recebe JSON `{ "latitude": -23.55, "longitude": -46.63 }`.
4. O serviço consulta o endereço aproximado do ponto. O backend procura no MySQL
   nomes correspondentes, dentro da mesma cidade e UF, e com cadastros ativos.
5. A resposta traz `{ cidade, bairro, bairroSugerido, mensagem }`. Quando encontrado,
   `bairro` contém `{ id, nome, cidade }`. Sem correspondência segura, `bairro` é
   null e a pessoa precisa escolher um bairro cadastrado manualmente.

As duas rotas exigem sessão autenticada. Erros de entrada retornam 400; formato
de coordenadas não JSON, 415; excesso na fila, 429; provedor indisponível, 503.
Respostas antigas não sobrescrevem uma escolha manual mais recente. Mudar o
ponto limpa o bairro do ponto anterior até a nova identificação.

## Limites que precisam ficar claros

O serviço externo identifica um endereço próximo, não prova que o ponto está
dentro de um polígono de bairro. Nomes e divisões do OpenStreetMap podem diferir
do cadastro do projeto; a pessoa deve conferir o mapa e o bairro antes do envio.
O banco atual foi carregado com bairros de São Paulo. Um local fora da área
atendida pode não ter correspondência; não criamos cidades ou bairros no banco.

A busca não altera as coordenadas escolhidas para a ocorrência com as coordenadas
do endereço próximo. A precisão da localização atual depende do dispositivo.
O envio do relato já chama `POST /api/relatos` e mostra a confirmação com o
identificador público após a resposta do servidor. O upload de foto continua
pendente e o campo está desabilitado. Veja `CONTRATO-CRIAR-RELATO.md`.

## Serviço usado

[Photon](https://photon.komoot.io/), com dados do OpenStreetMap, permite sugestões
e geocodificação reversa. O servidor público aceita uso moderado em projetos,
limita uso intenso e não garante disponibilidade. Antes de lançamento amplo,
avaliar um provedor contratado ou uma instância própria.

O backend usa uma fila com intervalo mínimo de um segundo entre consultas,
máximo de quatro consultas pendentes, tempo limite de oito segundos por chamada
externa, cache em memória por dois minutos e deduplicação de pedidos simultâneos.
Esses limites valem por processo Node. As sugestões esperam 700 ms sem digitação.

Nenhuma chave nova é necessária para o servidor público. Para trocar de instância,
configure opcionalmente `PHOTON_URL` no ambiente (ex.: URL de uma instância Photon
própria). Não é necessário alterar o .env para os testes atuais.

A página informa o uso do Photon. Endereços e coordenadas selecionadas são
enviados ao provedor por intermédio do backend; não enviamos dados da conta.

Referências: [API Photon](https://github.com/komoot/photon/blob/master/docs/api-v1.md),
[Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
