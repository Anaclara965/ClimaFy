import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { rankingAPI, unwrap } from '../services/api.js';

const fallbackRankingRows = [
  { name: 'Bras', city: 'Sao Paulo, SP', reports: 147, investment: 124000, score: 91, risk: 'CRITICA', tone: 'red', trend: '+12' },
  { name: 'Vila Madalena', city: 'Sao Paulo, SP', reports: 118, investment: 210000, score: 88, risk: 'CRITICA', tone: 'red', trend: '+8' },
  { name: 'Pinheiros', city: 'Sao Paulo, SP', reports: 94, investment: 380000, score: 71, risk: 'ALTA', tone: 'orange', trend: '0' },
  { name: 'Mooca', city: 'Sao Paulo, SP', reports: 82, investment: 290000, score: 67, risk: 'ALTA', tone: 'orange', trend: '+3' },
  { name: 'Consolacao', city: 'Sao Paulo, SP', reports: 67, investment: 455000, score: 49, risk: 'MEDIA', tone: 'yellow', trend: '-3' },
  { name: 'Butanta', city: 'Sao Paulo, SP', reports: 56, investment: 125000, score: 44, risk: 'MEDIA', tone: 'yellow', trend: '+7' },
  { name: 'Perdizes', city: 'Sao Paulo, SP', reports: 38, investment: 650000, score: 21, risk: 'BAIXA', tone: 'green', trend: '-4' },
  { name: 'Lapa', city: 'Sao Paulo, SP', reports: 34, investment: 754000, score: 18, risk: 'BAIXA', tone: 'green', trend: '-9' },
];

const toneStyles = {
  red: { text: 'text-[#d62727]', bg: 'bg-[#ffe0e0]', fill: '#d62727' },
  orange: { text: 'text-[#f37d22]', bg: 'bg-[#ffede0]', fill: '#f37d22' },
  yellow: { text: 'text-[#b88700]', bg: 'bg-[#fff4cc]', fill: '#f2c94c' },
  green: { text: 'text-[#1a9651]', bg: 'bg-[#e0f5e9]', fill: '#1a9651' },
};

const zones = [
  ['Zona Leste', 372, 'R$ 420 mil', '#d62727'],
  ['Zona Norte', 196, 'R$ 890 mil', '#f37d22'],
  ['Zona Sul', 156, 'R$ 580 mil', '#f2c94c'],
  ['Zona Oeste', 98, 'R$ 1,2 mi', '#63a93a'],
  ['Centro', 244, 'R$ 310 mil', '#f37d22'],
];

const historyRows = [
  ['Bras', 66, 68, 72, 76, 81, 87, 91],
  ['Vila Madalena', 67, 70, 73, 78, 81, 83, 88],
  ['Pinheiros', 62, 65, 64, 68, 69, 70, 71],
  ['Mooca', 49, 51, 56, 59, 61, 64, 67],
  ['Consolacao', 45, 44, 46, 48, 51, 50, 49],
];

const categoryCards = [
  { name: 'Bras', total: 147, dominant: ['Alag.', 58, '#2469d6'], parts: [['Alag.', 58, '#2469d6'], ['Lixo', 18, '#8b6328'], ['Fogo', 14, '#d62727'], ['Arv.', 10, '#63a93a']] },
  { name: 'Vila Madalena', total: 118, dominant: ['Fogo', 52, '#d62727'], parts: [['Fogo', 52, '#d62727'], ['Alag.', 28, '#2469d6'], ['Lixo', 12, '#8b6328'], ['Arv.', 8, '#63a93a']] },
  { name: 'Pinheiros', total: 94, dominant: ['Calor', 44, '#f35c22'], parts: [['Calor', 44, '#f35c22'], ['Alag.', 32, '#2469d6'], ['Lixo', 14, '#8b6328'], ['Fogo', 10, '#d62727']] },
  { name: 'Mooca', total: 82, dominant: ['Lixo', 58, '#8b6328'], parts: [['Lixo', 58, '#8b6328'], ['Alag.', 22, '#2469d6'], ['Calor', 12, '#f35c22'], ['Arv.', 8, '#63a93a']] },
];

const money = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const parseMoney = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const text = String(value).toLowerCase().replace(/\s/g, '');
  const numeric = Number(text.replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (text.includes('mi')) return numeric * 1000000;
  if (text.includes('k') || text.includes('mil')) return numeric * 1000;
  return Number.isNaN(numeric) ? 0 : numeric;
};

const normalizeRankingRows = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.ranking ?? payload?.items ?? [];

  return items.map((item, index) => {
    const score = Number(item.score ?? item.riskScore ?? 0);
    const risk = (item.risk ?? item.classification ?? (score >= 85 ? 'CRITICA' : score >= 60 ? 'ALTA' : score >= 40 ? 'MEDIA' : 'BAIXA')).toUpperCase();
    const tone = item.tone ?? (risk === 'CRITICA' ? 'red' : risk === 'ALTA' ? 'orange' : risk === 'MEDIA' ? 'yellow' : 'green');

    return {
      name: item.name ?? item.neighborhood?.name ?? item.neighborhood ?? item.bairro ?? `Bairro ${index + 1}`,
      city: item.city ?? item.neighborhood?.city ?? 'Sao Paulo, SP',
      reports: Number(item.reports ?? item.openReports ?? item.relatosAbertos ?? 0),
      investment: parseMoney(item.investment ?? item.investmentAmount ?? item.totalInvestment),
      score,
      risk,
      tone,
      trend: String(item.trend ?? item.tendencia ?? '0'),
    };
  });
};

export default function RankingPage() {
  const [rankingRows, setRankingRows] = useState(fallbackRankingRows);
  const [sortMode, setSortMode] = useState('vulnerability');
  const [period, setPeriod] = useState('year');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRanking = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = unwrap(await rankingAPI.list({ sort: sortMode, period, search }));
      const nextRows = normalizeRankingRows(data);
      setRankingRows(nextRows.length ? nextRows : fallbackRankingRows);
    } catch {
      setRankingRows(fallbackRankingRows);
      setError('Nao foi possivel carregar o ranking do backend. Exibindo dados mockados.');
    } finally {
      setLoading(false);
    }
  }, [period, search, sortMode]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  const maxReports = Math.max(...rankingRows.map((item) => item.reports));
  const chartRows = useMemo(() => rankingRows.map((item) => ({
    bairro: item.name.split(' ')[0],
    score: item.score,
    investimento: Math.round(item.investment / 10000),
  })), [rankingRows]);

  return (
    <div className="bg-[#f8fafb] text-[#15191e]">
      <section className="grid min-h-[120px] grid-cols-[1fr_548px] gap-12 bg-[#0a4624] px-[72px] py-[22px] text-white max-lg:grid-cols-1 max-md:px-6" aria-labelledby="ranking-title">
        <div>
          <h1 id="ranking-title" className="text-[28px] font-bold leading-tight">Ranking de Vulnerabilidade Urbana</h1>
          <p className="mt-2 max-w-[700px] text-[15px] leading-snug text-[#c7ead1]">Bairros ordenados por nivel de risco climatico cruzado com investimento publico declarado.</p>
        </div>
        <dl className="grid grid-cols-4 gap-5 max-sm:grid-cols-2">
          {[
            ['8', 'Bairros monitorados'],
            ['1.247', 'Relatos no mes'],
            ['R$ 2,4M', 'Investimento cruzado'],
            ['12', 'Cidades'],
          ].map(([value, label]) => (
            <div className="flex flex-col" key={label}>
              <dt className="order-2 mt-2 text-[10px] leading-tight text-[#c7ead1]">{label}</dt>
              <dd className="order-1 text-[22px] font-bold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border border-[#e3e8ec] bg-white px-[72px] py-[11px] max-md:px-6" aria-label="Controles do ranking">
        <form className="grid min-h-8 grid-cols-[auto_1fr_267px] items-center gap-11 max-xl:grid-cols-1 max-xl:gap-4">
          <fieldset className="flex items-center gap-2 border-0 max-sm:flex-wrap">
            <legend className="mr-4 text-[13px] font-medium text-[#48525f]">Ordenar por:</legend>
            <button className={`h-8 rounded-lg px-4 text-[12px] ${sortMode === 'vulnerability' ? 'bg-[#15191e] font-semibold text-white' : 'bg-[#eff3f5] text-[#48525f]'}`} onClick={() => setSortMode('vulnerability')} type="button">Mais Vulneraveis</button>
            <button className={`h-8 rounded-lg px-4 text-[12px] ${sortMode === 'investment' ? 'bg-[#15191e] font-semibold text-white' : 'bg-[#eff3f5] text-[#48525f]'}`} onClick={() => setSortMode('investment')} type="button">Menos Investidos</button>
          </fieldset>
          <fieldset className="flex items-center gap-8 border-0 max-sm:flex-wrap max-sm:gap-2">
            <legend className="text-[13px] font-medium text-[#48525f]">Periodo:</legend>
            {[
              ['7d', '7 dias'],
              ['30d', '30 dias'],
              ['90d', '90 dias'],
            ].map(([value, label]) => (
              <button className={`h-8 rounded-lg border border-[#e3e8ec] px-3 text-[12px] ${period === value ? 'bg-[#15191e] font-semibold text-white' : 'text-[#8b96a3]'}`} onClick={() => setPeriod(value)} type="button" key={value}>{label}</button>
            ))}
            <button className={`h-8 rounded-lg px-3 text-[12px] ${period === 'year' ? 'bg-[#15191e] font-semibold text-white' : 'border border-[#e3e8ec] text-[#8b96a3]'}`} onClick={() => setPeriod('year')} type="button">Este ano</button>
          </fieldset>
          <label className="flex h-8 items-center rounded-lg border border-[#d1d8de] bg-[#f8fafb] px-4">
            <span className="sr-only">Buscar bairro</span>
            <input className="w-full bg-transparent text-[12px] outline-none placeholder:text-[#8b96a3]" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar bairro..." type="search" value={search} />
          </label>
        </form>
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadRanking} /> : null}

      <section aria-labelledby="table-title" className="overflow-auto border-b border-[#e3e8ec] bg-white max-md:hidden">
        <h2 id="table-title" className="sr-only">Tabela do ranking</h2>
        <table className="w-full min-w-[1120px] table-fixed border-collapse">
          <thead className="sticky top-0 z-10 h-11 bg-[#eff3f5] text-left text-[11px] font-semibold text-[#8b96a3]">
            <tr>
              {['#', 'Bairro', 'Relatos Abertos', 'Investimento (R$)', 'Score', 'Classificacao', 'Tendencia', 'Acao'].map((head) => (
                <th className="px-3 first:pl-[72px] last:pr-[72px]" scope="col" key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, index) => (
              <tr className="h-[58px] border-b border-[#e3e8ec]" key={index}>
                <td className="pl-[72px]" colSpan="8"><span className="block h-5 w-[85%] animate-pulse rounded bg-[#e3e8ec]" /></td>
              </tr>
            )) : rankingRows.map((item, index) => {
              const tone = toneStyles[item.tone] ?? toneStyles.green;
              const detailHref = item.name === 'Bras' ? '/bairro/bras' : item.name === 'Pinheiros' ? '/bairro/pinheiros' : '#';
              return (
                <tr className="h-[58px] border-b border-[#e3e8ec] odd:bg-white even:bg-[#f8fafb]" key={item.name}>
                  <td className="pl-[72px]"><span className={`grid size-7 place-items-center rounded-lg text-[12px] font-bold ${index < 2 ? 'bg-[#116b38] text-white' : 'bg-[#eff3f5] text-[#48525f]'}`}>{index + 1}</span></td>
                  <td><strong className="block text-[14px]">{item.name}</strong><span className="text-[11px] text-[#8b96a3]">{item.city}</span></td>
                  <td><span className="grid grid-cols-[135px_auto] items-center gap-2"><span className="h-2 rounded bg-[#e3e8ec]"><i className="block h-2 rounded" style={{ width: `${(item.reports / maxReports) * 100}%`, background: tone.fill }} /></span><strong className="text-[13px] text-[#48525f]">{item.reports}</strong></span></td>
                  <td className="text-[13px] text-[#48525f]">{money(item.investment)}</td>
                  <td><strong className={`grid h-11 w-[45px] place-items-center rounded-[22px] border-2 text-[14px] ${tone.bg} ${tone.text}`} style={{ borderColor: tone.fill }}>{item.score}</strong></td>
                  <td><span className={`rounded-xl px-3 py-1 text-[11px] font-bold ${tone.bg} ${tone.text}`}>{item.risk}</span></td>
                  <td className={`text-[13px] font-semibold ${item.trend.startsWith('+') ? 'text-[#d62727]' : 'text-[#1a9651]'}`}>{item.trend.startsWith('+') ? '↑' : item.trend === '0' ? '→' : '↓'} {item.trend}</td>
                  <td className="pr-[72px]"><a className="grid h-7 w-[92px] place-items-center rounded-lg bg-[#e0f5e9] text-[12px] font-semibold text-[#1a9651]" href={detailHref}>Ver bairro →</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="hidden bg-white px-5 py-5 max-md:block" aria-label="Ranking em cards">
        <div className="grid gap-3">
          {loading ? Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} />) : rankingRows.map((item, index) => {
            const tone = toneStyles[item.tone] ?? toneStyles.green;
            const detailHref = item.name === 'Bras' ? '/bairro/bras' : item.name === 'Pinheiros' ? '/bairro/pinheiros' : '#';

            return (
              <article className="rounded-xl border border-[#e3e8ec] bg-[#f8fafb] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]" key={item.name}>
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <span className="grid size-8 place-items-center rounded-lg bg-[#15191e] text-[12px] font-bold text-white">#{index + 1}</span>
                    <h2 className="mt-3 text-[18px] font-bold">{item.name}</h2>
                    <p className="text-[11px] text-[#8b96a3]">{item.city}</p>
                  </div>
                  <strong className={`grid size-12 place-items-center rounded-full border-2 text-[14px] ${tone.bg} ${tone.text}`} style={{ borderColor: tone.fill }}>{item.score}</strong>
                </header>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div><dt className="text-[#8b96a3]">Relatos abertos</dt><dd className="font-bold">{item.reports}</dd></div>
                  <div><dt className="text-[#8b96a3]">Investimento</dt><dd className="font-bold">{money(item.investment)}</dd></div>
                  <div><dt className="text-[#8b96a3]">Classificacao</dt><dd className={`inline-flex rounded-xl px-3 py-1 text-[10px] font-bold ${tone.bg} ${tone.text}`}>{item.risk}</dd></div>
                  <div><dt className="text-[#8b96a3]">Tendencia</dt><dd className="font-bold">{item.trend}</dd></div>
                </dl>
                <a className="mt-4 grid h-9 place-items-center rounded-lg bg-[#e0f5e9] text-[12px] font-semibold text-[#1a9651]" href={detailHref}>Ver bairro →</a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto my-4 w-[calc(100%-48px)] max-w-[1276px] rounded-[14px] border border-[#e3e8ec] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]" aria-labelledby="chart-title">
        <h2 id="chart-title" className="text-[13px] font-bold">Score de Vulnerabilidade - Top 8 Bairros</h2>
        <p className="text-[10px] text-[#8b96a3]">Comparativo entre score calculado e investimento declarado</p>
        <div className="mt-4 h-[285px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 28, left: 8, bottom: 34 }}>
              <CartesianGrid stroke="#eff3f5" vertical={false} />
              <XAxis dataKey="bairro" tick={{ fontSize: 10, fill: '#8b96a3' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8b96a3' }} />
              <Tooltip />
              <Legend
                align="center"
                verticalAlign="bottom"
                wrapperStyle={{ color: '#48525f', fontSize: 11, lineHeight: '18px', paddingTop: 12, whiteSpace: 'normal' }}
              />
              <Bar dataKey="score" name="Score de Vulnerabilidade" fill="#d62727" radius={[2, 2, 0, 0]} />
              <Bar dataKey="investimento" name="Investimento relativo" fill="#1a9651" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1276px] grid-cols-[320px_1fr] gap-8 px-6 py-8 max-lg:grid-cols-1" aria-labelledby="method-title">
        <article>
          <p className="inline-flex h-[22px] items-center rounded-xl bg-[#e0f5e9] px-3 text-[10px] font-bold uppercase text-[#1a9651]">Metodologia</p>
          <h2 id="method-title" className="mt-3 text-[24px] font-bold leading-tight">Como calculamos o score de vulnerabilidade</h2>
          <p className="mt-3 text-[13px] leading-snug text-[#48525f]">O indice combina relatos, investimento publico declarado e concentracao por categoria.</p>
          <strong className="mt-5 block rounded-lg bg-[#15191e] p-4 text-[12px] leading-relaxed text-[#c7ead1]">Score = Relatos x 0,5 + Deficit de Investimento x 0,4 + Conflito x 0,1</strong>
        </article>
        <ol className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
          {[
            ['Relatos em Aberto', 'Peso: 50%', '#d62727'],
            ['Deficit de Investimento', 'Peso: 40%', '#f37d22'],
            ['Atualizacao Continua', 'Peso: 10%', '#2469d6'],
          ].map(([title, weight, color]) => (
            <li className="rounded-[14px] border border-[#e3e8ec] border-t-[3px] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]" style={{ borderTopColor: color }} key={title}>
              <h3 className="text-[14px] font-bold">{title}</h3>
              <p className="mt-3 text-[12px] font-semibold text-[#1a9651]">{weight}</p>
              <small className="mt-2 block text-[11px] leading-snug text-[#8b96a3]">Criterio normalizado diariamente com dados da plataforma.</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-[1276px] grid-cols-[360px_1fr] gap-8 px-6 py-8 max-lg:grid-cols-1" aria-labelledby="investment-title">
        <article>
          <p className="inline-flex h-[22px] items-center rounded-xl bg-[#e0f5e9] px-3 text-[10px] font-bold uppercase text-[#1a9651]">Analise territorial</p>
          <h2 id="investment-title" className="mt-3 text-[24px] font-bold leading-tight">Investimento declarado vs. relatos registrados por zona</h2>
          <p className="mt-3 text-[13px] leading-snug text-[#48525f]">Visualize onde a verba publica cruza os pontos de vulnerabilidade.</p>
          <ul className="mt-6 grid gap-2">
            {zones.map(([name, reports, amount, color]) => (
              <li className="grid grid-cols-[6px_1fr_auto] items-center gap-3 rounded-lg bg-white text-[11px] text-[#48525f]" key={name}>
                <i className="h-8 rounded" style={{ background: color }} />
                <span><strong className="block text-[#15191e]">{name}</strong>{amount}</span>
                <strong>{reports}</strong>
              </li>
            ))}
          </ul>
        </article>
        <figure className="grid min-h-[360px] grid-cols-3 gap-4 rounded-[10px] bg-[#dcebe2] p-8 text-center text-[11px] font-bold max-md:grid-cols-1">
          {zones.concat([['Sudeste', 73, 'R$ 510 mil', '#f37d22']]).map(([name, score, , color]) => (
            <div className="grid place-items-center rounded-md border border-[#116b3840] text-white" style={{ background: `${color}55`, color }} key={name}>
              <span>{name}<strong className="mt-2 grid h-5 min-w-8 place-items-center rounded-full bg-white px-2">{score}</strong></span>
            </div>
          ))}
        </figure>
      </section>

      <section className="mx-auto grid max-w-[1276px] grid-cols-[330px_1fr] gap-8 px-6 py-8 max-lg:grid-cols-1" aria-labelledby="history-title">
        <article>
          <p className="inline-flex h-[22px] items-center rounded-xl bg-[#e0f5e9] px-3 text-[10px] font-bold uppercase text-[#1a9651]">Evolucao mensal</p>
          <h2 id="history-title" className="mt-3 text-[24px] font-bold leading-tight">Como o ranking mudou nos ultimos 6 meses</h2>
          <p className="mt-3 text-[13px] text-[#48525f]">Acompanhe a mudanca de score dos bairros mais sensiveis.</p>
        </article>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] rounded-xl bg-white text-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <thead className="text-[#8b96a3]"><tr>{['Bairro', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'].map((h) => <th className="h-11 px-4 text-left first:text-left" key={h}>{h}</th>)}</tr></thead>
            <tbody>{historyRows.map(([name, ...scores]) => <tr className="border-t border-[#e3e8ec]" key={name}><td className="h-11 px-4 font-bold">{name}</td>{scores.map((score, idx) => <td className="px-4" key={`${name}-${idx}`}>{idx === scores.length - 1 ? <span className="rounded-xl bg-[#ffe0e0] px-3 py-1 text-[10px] font-bold text-[#d62727]">{score}</span> : score}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1276px] grid-cols-[300px_1fr] gap-8 px-6 py-8 max-lg:grid-cols-1" aria-labelledby="category-title">
        <header>
          <p className="inline-flex h-[22px] items-center rounded-xl bg-[#e0f5e9] px-3 text-[10px] font-bold uppercase text-[#1a9651]">Detalhamento por categoria</p>
          <h2 id="category-title" className="mt-3 text-[24px] font-bold leading-tight">Qual tipo de problema predomina em cada bairro vulneravel?</h2>
          <p className="mt-3 text-[13px] text-[#48525f]">Entenda a composicao dos relatos em cada bairro.</p>
        </header>
        <div className="grid grid-cols-4 gap-5 max-xl:grid-cols-2 max-md:grid-cols-1">
          {categoryCards.map((card) => (
            <article className="rounded-[14px] border border-[#e3e8ec] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]" key={card.name}>
              <h3 className="text-[14px] font-bold">{card.name}</h3>
              <p className="mt-1 text-[10px] text-[#8b96a3]">Distribuicao de relatos</p>
              <div className="mt-7 flex h-5 overflow-hidden rounded bg-[#eff3f5]">{card.parts.map(([label, value, color]) => <span aria-label={label} className="h-full" style={{ width: `${value}%`, background: color }} key={label} />)}</div>
              <ul className="mt-4 grid grid-cols-2 gap-3">{card.parts.map(([label, value, color]) => <li className="flex items-center gap-2 text-[11px] text-[#48525f]" key={label}><i className="size-2.5 rounded-full" style={{ background: color }} />{label} {value}%</li>)}</ul>
              <p className="mt-5 border-t border-[#eff3f5] pt-4 text-[10px] text-[#8b96a3]">Categoria dominante: <strong className="rounded-lg px-2 py-1 text-[11px]" style={{ background: `${card.dominant[2]}1f`, color: card.dominant[2] }}>{card.dominant[0]}</strong> <b style={{ color: card.dominant[2] }}>{card.dominant[1]}%</b></p>
              <p className="mt-3 border-t border-[#eff3f5] pt-3 text-[12px] font-bold">{card.total} relatos abertos</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <section className="mx-auto my-4 flex w-[calc(100%-48px)] max-w-[1276px] flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f4b60d]/40 bg-[#fff6d6] px-5 py-3 text-[12px] font-semibold text-[#725600]" aria-live="polite">
      <span>{message}</span>
      <button className="rounded-md bg-[#15191e] px-3 py-2 text-white" onClick={onRetry} type="button">Tentar novamente</button>
    </section>
  );
}

function SkeletonCard() {
  return <article className="h-44 animate-pulse rounded-xl border border-[#e3e8ec] bg-[#e3e8ec]" aria-label="Carregando ranking" />;
}
