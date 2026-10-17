// Cria um usuario direto no banco. Serve para o PRIMEIRO ADMINISTRADOR
// (sem ele ninguem entra em /adm) e para popular a demo.
//
// Uso com argumentos:
//   npm run criar-usuario -- --email=admin@climafy.app --nome=Ana --sobrenome=Clara --papel=administrador --senha=Clima2026!
//
// Uso interativo (pergunta os dados, esconde a senha):
//   npm run criar-usuario
require("dotenv").config();

const readline = require("readline-sync");

const usuarioModel = require("../app/models/usuarioModel");
const { gerarHash, requisitosFaltando } = require("../app/helpers/senha");

const PAPEIS = ["cidadao", "moderador", "administrador"];

function lerArgumentos() {
  const argumentos = {};
  for (const bruto of process.argv.slice(2)) {
    const [chave, valor] = bruto.replace(/^--/, "").split("=");
    if (chave) argumentos[chave] = valor ?? "";
  }
  return argumentos;
}

async function main() {
  const argumentos = lerArgumentos();

  const email = argumentos.email || readline.question("E-mail: ").trim();
  const nome = argumentos.nome || readline.question("Nome: ").trim();
  const sobrenome = argumentos.sobrenome || readline.question("Sobrenome: ").trim();

  let papel = (argumentos.papel || readline.question(`Papel (${PAPEIS.join(", ")}) [cidadao]: `)).trim();
  if (!papel) papel = "cidadao";
  if (!PAPEIS.includes(papel)) {
    console.error(`Papel invalido: "${papel}". Use um de: ${PAPEIS.join(", ")}.`);
    process.exit(1);
  }

  const senha =
    argumentos.senha ||
    readline.question("Senha: ", { hideEchoBack: true, mask: "*" });

  const faltando = requisitosFaltando(senha);
  if (faltando.length) {
    console.error(
      `Senha fraca. Falta: ${faltando.map((requisito) => requisito.label).join("; ")}.`
    );
    process.exit(1);
  }

  const existente = await usuarioModel.buscarPorEmail(email);
  if (existente) {
    console.error(`Ja existe usuario com o e-mail ${email}.`);
    process.exit(1);
  }

  const usuario = await usuarioModel.criarUsuario({
    nome,
    sobrenome,
    email,
    senhaHash: await gerarHash(senha),
    papel,
  });

  // Conta criada por operador ja nasce com o e-mail verificado.
  await usuarioModel.marcarEmailVerificado(usuario.id);

  console.log(`\nUsuario criado com sucesso:
  id:    ${usuario.id}
  nome:  ${usuario.nome} ${usuario.sobrenome}
  email: ${usuario.email}
  papel: ${papel} (e-mail ja verificado).

Entre em http://localhost:${process.env.PORT || 3000}/login`);
  process.exit(0);
}

main().catch((erro) => {
  console.error("\nFALHA ao criar usuario ->", erro.message);
  process.exit(1);
});
