// Hash e conferencia de senha. bcryptjs e JavaScript puro (mesma API do bcrypt),
// entao instala em qualquer maquina sem compilar nada.
const bcrypt = require("bcryptjs");

// Custo do bcrypt. 12 e o valor recomendado hoje (quanto maior, mais lento).
const CUSTO = 12;

// Regra de complexidade UNICA do projeto (README secao 6.3).
// O front mostra o checklist, o express-validator chama senhaInvalida() e o
// servidor grava o hash: todos usam esta lista, para nao divergir de novo.
const REQUISITOS_SENHA = [
  { id: "len", label: "Minimo 8 caracteres", teste: (valor) => valor.length >= 8 },
  { id: "upper", label: "Pelo menos uma letra maiuscula", teste: (valor) => /[A-Z]/.test(valor) },
  { id: "lower", label: "Pelo menos uma letra minuscula", teste: (valor) => /[a-z]/.test(valor) },
  { id: "number", label: "Pelo menos um numero", teste: (valor) => /[0-9]/.test(valor) },
  { id: "symbol", label: "Pelo menos um simbolo (!@#$%)", teste: (valor) => /[^A-Za-z0-9]/.test(valor) },
];

// Retorna a lista de requisitos NAO atendidos (vazia = senha valida).
function requisitosFaltando(senha = "") {
  return REQUISITOS_SENHA.filter((requisito) => !requisito.teste(String(senha)));
}

function senhaValida(senha = "") {
  return requisitosFaltando(senha).length === 0;
}

function gerarHash(senha) {
  return bcrypt.hash(String(senha), CUSTO);
}

function conferirSenha(senha, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(String(senha), hash);
}

module.exports = {
  CUSTO,
  REQUISITOS_SENHA,
  requisitosFaltando,
  senhaValida,
  gerarHash,
  conferirSenha,
};
