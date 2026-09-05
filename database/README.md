# Banco de dados do ClimaFy

O arquivo `schema.sql` cria o banco `climafy`, as quatro tabelas do MVP e as oito categorias iniciais.

Ordem das dependencias:

1. `usuarios` guarda cidadaos e administradores.
2. `categorias` define os tipos e as cores dos relatos.
3. `relatos` referencia um usuario e uma categoria.
4. `moderacoes` registra qual administrador aprovou ou rejeitou cada relato.

Regras centrais:

- O e-mail do usuario e unico.
- Todo relato nasce com o status `pendente`.
- Latitude e longitude precisam estar dentro dos limites geograficos validos.
- Um relato rejeitado precisa ter justificativa.
- O mapa publico devera consultar somente relatos com status `aprovado`.

Para criar o banco pelo MySQL Workbench, abra `schema.sql` e execute o arquivo completo. Nao coloque senhas reais no codigo: copie `.env.example` para `.env` e preencha apenas no seu computador.
