# ClimaFy

Plataforma web colaborativa para registrar, moderar e visualizar relatos climaticos e ambientais em nivel local.

## Estado atual

- Frontend em EJS, CSS e JavaScript.
- Rotas publicas e administrativas renderizando.
- Teste automatico das rotas e dos links internos.
- Schema inicial do MySQL em `database/schema.sql`.
- Formularios de cadastro, login e relato ainda funcionam como prototipos visuais; a persistencia sera ligada nos proximos marcos.

## Executar o projeto

1. Instale as dependencias com `npm install`.
2. Copie `.env.example` para `.env` e ajuste os valores locais.
3. Execute `npm start`.
4. Acesse `http://localhost:3000`.

O servidor usa a variavel `PORT` quando ela estiver definida; caso contrario, usa a porta 3000.

## Testes

Execute `npm test`. A suite verifica o health check, a renderizacao das paginas principais, os links internos e o retorno 404 para enderecos inexistentes.

## Banco de dados

Abra `database/schema.sql` no MySQL Workbench e execute o arquivo inteiro. Ele cria:

1. `usuarios`;
2. `categorias`;
3. `relatos`;
4. `moderacoes`;
5. as oito categorias iniciais do ClimaFy.

O arquivo `.env` nao deve ser enviado ao GitHub.

## Proximo marco

Adicionar o pool de conexoes com `mysql2`, criar os models e implementar cadastro e login com `bcrypt` e `express-session`.
