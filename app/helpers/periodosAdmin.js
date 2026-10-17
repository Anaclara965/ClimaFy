// Datas civis de São Paulo, sem depender do fuso da máquina ou das tabelas TZ do MySQL.
const FUSO = "America/Sao_Paulo";
const formatador = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
function dataCivil(instante) {
  const partes = Object.fromEntries(formatador.formatToParts(instante).map(p => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}
function somarDias(data, quantidade) {
  const instante = new Date(data + "T12:00:00Z");
  instante.setUTCDate(instante.getUTCDate() + quantidade);
  return instante.toISOString().slice(0, 10);
}
function inicioCivil(data) {
  const partes = new Intl.DateTimeFormat("en", { timeZone: FUSO, timeZoneName: "longOffset" })
    .formatToParts(new Date(data + "T12:00:00Z"));
  const offset = partes.find(p => p.type === "timeZoneName").value.replace("GMT", "") || "Z";
  return new Date(data + "T00:00:00" + offset);
}
function periodosAdmin(agora = new Date()) {
  const hoje = dataCivil(agora), mes = hoje.slice(0, 8) + "01";
  const diaSemana = new Date(hoje + "T12:00:00Z").getUTCDay();
  const segunda = somarDias(hoje, -((diaSemana + 6) % 7));
  const dias = Array.from({ length: 14 }, (_, indice) => {
    const data = somarDias(hoje, indice - 13);
    return { data, inicio: inicioCivil(data), fim: indice === 13 ? agora : inicioCivil(somarDias(data, 1)) };
  });
  return { agora, fuso: FUSO, hoje, inicioMes: inicioCivil(mes), inicioSemana: inicioCivil(segunda),
    inicioSemanaAnterior: inicioCivil(somarDias(segunda, -7)), dias };
}
module.exports = { periodosAdmin, dataCivil };
