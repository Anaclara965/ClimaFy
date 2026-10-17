const MAX_VERSAO = 4294967295;
function versaoValida(valor) {
  return typeof valor === "string" && /^[1-9]\d{0,9}$/.test(valor) && Number(valor) <= MAX_VERSAO;
}
module.exports = { versaoValida, MAX_VERSAO };
