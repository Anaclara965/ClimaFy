import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { neighborhoodsAPI, unwrap } from '../services/api.js';

const neighborhoods = {
  bras: {
    slug: 'bras',
    name: 'Bras',
    city: 'Sao Paulo, SP - Zona Leste',
    badge: 'CRITICA',
    position: '#1',
    score: 91,
    scoreLabel: 'Score de Vulnerabilidade',
    scoreColor: '#d62727',
    scoreSoft: '#ffe0e0',
    kpis: [
      ['147', 'Relatos Abertos', '↑ 12 esta semana', '#d62727'],
      ['R$ 124K', 'Investimento', '↓ -43% vs meta', '#f37d22'],
      ['91', 'Score', 'Mais alto da cidade', '#d62727'],
      ['22', 'Resolvidos', 'Nos ultimos 30 dias', '#f37d22'],
      ['2', 'Dias desde ultimo', 'Relato novo hoje', '#2469d6'],
      ['+12%', 'Tendencia', 'Risco subindo', '#f35c22'],
    ],
    categories: [
      ['Alagamento', 68, '#2469d6'],
      ['Lixo Irregular', 15, '#8b6328'],
      ['Calor Extremo', 10, '#f35c22'],
      ['Queimada', 5, '#d62727'],
      ['Outros', 2, '#8b96a3'],
    ],
    deficitTitle: 'Deficit de Investimento - Bras vs. Meta Municipal',
    mapLabel: 'Bras',
    coords: '-23.5499, -46.6169 - Sao Paulo',
    mapShape: { rect: '30,32,300,145', circle: [167, 96], text: [167, 129] },
    scoreFactors: [
      ['Relatos em aberto', 'Peso: 60%', 147, 200, 53, '#d62727'],
      ['Deficit de invest.', 'Peso: 40%', 76, 100, 38, '#f37d22'],
    ],
    totalScore: '91 / 100',
    timeline: [
      ['Alagamento', 'Rua do Gasometro alagada', 'Ha 2 horas', 'Aberto', '#2469d6'],
      ['Lixo Irregular', 'Entulho bloqueando calcada', 'Ha 5 horas', 'Em andamento', '#8b6328'],
      ['Alagamento', 'Bueiro entupido Av. Rangel Pestana', 'Ha 1 dia', 'Aberto', '#2469d6'],
      ['Calor Extremo', 'Praca sem sombra ou agua', 'Ha 2 dias', 'Aberto', '#f35c22'],
      ['Queimada', 'Vegetacao queimando prox. trilhos', 'Ha 3 dias', 'Resolvido', '#d62727'],
    ],
  },
  pinheiros: {
    slug: 'pinheiros',
    name: 'Pinheiros',
    city: 'Sao Paulo, SP - Zona Leste',
    badge: 'ALTA',
    position: '#3',
    score: 71,
    scoreLabel: 'Score de Vulnerabilidade',
    scoreColor: '#f37d22',
    scoreSoft: '#ffede0',
    kpis: [
      ['94', 'Relatos Abertos', '↑ 12 esta semana', '#f37d22'],
      ['R$ 380K', 'Investimento', '↓ -30% vs meta', '#f37d22'],
      ['91', 'Score de Risco', 'Alto impacto local', '#f37d22'],
      ['22', 'Dias s/ resolucao', 'Fila critica', '#f37d22'],
      ['35%', 'Relatos p/ Alagamento', 'Categoria dominante', '#2469d6'],
      ['38.4°C', 'Temp max', 'Ilha de calor', '#f35c22'],
    ],
    categories: [
      ['Alagamento', 35, '#2469d6'],
      ['Lixo Irregular', 25, '#8b6328'],
      ['Calor Extremo', 15, '#f35c22'],
      ['Queimada', 12, '#d62727'],
      ['Arvore caida', 8, '#63a93a'],
      ['Poluicao Agua', 5, '#129ab9'],
    ],
    deficitTitle: 'Deficit de Investimento - Pinheiros vs. Meta Municipal',
    mapLabel: 'Pinheiros',
    coords: '-23.5673, -46.7019 - Sao Paulo',
    mapShape: { rect: '60,52,260,122', circle: [204, 111], text: [204, 144] },
    scoreFactors: [
      ['Relatos em aberto', 'Peso: 60%', 94, 200, 43, '#f37d22'],
      ['Deficit de invest.', 'Peso: 40%', 58, 100, 28, '#2469d6'],
    ],
    totalScore: '71 / 100',
    timeline: [
      ['Alagamento', 'Rua Cardeal Arcoverde com pontos de alagamento', 'Ha 2 horas', 'Aberto', '#2469d6'],
      ['Lixo Irregular', 'Descarte bloqueando a calcada', 'Ha 5 horas', 'Em andamento', '#8b6328'],
      ['Calor Extremo', 'Ponto de onibus sem sombra', 'Ha 1 dia', 'Aberto', '#f35c22'],
      ['Arvore caida', 'Galho grande sobre a via local', 'Ha 2 dias', 'Aberto', '#63a93a'],
      ['Queimada', 'Foco de fumaca em terreno proximo', 'Ha 3 dias', 'Resolvido', '#d62727'],
    ],
  },
};

const monthly = [
  ['Jun', 38, 120], ['Jul', 52, 132], ['Ago', 35, 68], ['Set', 80, 140],
  ['Out', 95, 82], ['Nov', 110, 76], ['Dez', 130, 65], ['Jan', 118, 55],
  ['Fev', 138, 88], ['Mar', 126, 44], ['Abr', 142, 35], ['Mai', 139, 28],
];

const deficit = [
  ['Drenagem urbana', 16000, 100000],
  ['Pavimentacao', 42000, 80000],
  ['Coleta de residuos', 64000, 90000],
];

const related = [
  ['Mooca', 'ALTA', 67, '82 relatos - R$ 290K investidos', '#f37d22', '#'],
  ['Pinheiros', 'ALTA', 71, '94 relatos - R$ 380K investidos', '#f37d22', '/bairro/pinheiros'],
  ['Consolacao', 'MEDIA', 48, '61 relatos - R$ 450K investidos', '#f4b60d', '#'],
  ['Perdizes', 'BAIXA', 21, '28 relatos - R$ 680K investidos', '#1a9651', '#'],
];

const statusClass = {
  Aberto: 'bg-[#e0efff] text-[#1a61d6]',
  'Em andamento': 'bg-[#fff6d6] text-[#b08000]',
  Resolvido: 'bg-[#e0f5e9] text-[#1a9651]',
};

const normalizeNeighborhood = (payload, fallback) => {
  const data = payload?.neighborhood ?? payload;

  if (!data || typeof data !== 'object') return fallback;

  const score = Number(data.score ?? data.riskScore ?? fallback.score);
  const classification = (data.classification ?? data.risk ?? fallback.badge).toUpperCase();
  const scoreColor = data.scoreColor ?? (classification === 'CRITICA' ? '#d62727' : classification === 'ALTA' ? '#f37d22' : classification === 'MEDIA' ? '#f4b60d' : '#1a9651');

  return {
    ...fallback,
    name: data.name ?? data.bairro ?? fallback.name,
    city: data.city ?? data.location ?? fallback.city,
    badge: classification,
    position: data.position ? `#${data.position}` : data.rank ? `#${data.rank}` : fallback.position,
    score,
    scoreColor,
    scoreSoft: data.scoreSoft ?? fallback.scoreSoft,
    kpis: Array.isArray(data.kpis) ? data.kpis.map((item, index) => Array.isArray(item) ? item : [
      item.value ?? fallback.kpis[index]?.[0] ?? '-',
      item.label ?? fallback.kpis[index]?.[1] ?? 'Indicador',
      item.helper ?? item.sublabel ?? fallback.kpis[index]?.[2] ?? '',
      item.color ?? fallback.kpis[index]?.[3] ?? scoreColor,
    ]) : fallback.kpis,
    categories: Array.isArray(data.categories) ? data.categories.map((item) => [
      Array.isArray(item) ? item[0] : item.label ?? item.name,
      Number(Array.isArray(item) ? item[1] : item.value ?? item.percent ?? 0),
      Array.isArray(item) ? item[2] : item.color ?? '#2469d6',
    ]) : fallback.categories,
    timeline: Array.isArray(data.timeline) ? data.timeline.map((item) => [
      Array.isArray(item) ? item[0] : item.category ?? 'Relato',
      Array.isArray(item) ? item[1] : item.title ?? 'Relato da comunidade',
      Array.isArray(item) ? item[2] : item.time ?? item.createdAgo ?? 'Agora',
      Array.isArray(item) ? item[3] : item.status ?? 'Aberto',
      Array.isArray(item) ? item[4] : item.color ?? '#2469d6',
    ]) : fallback.timeline,
    totalScore: `${score} / 100`,
  };
};

export default function NeighborhoodPage() {
  const { slug } = useParams();
  const fallbackNeighborhood = neighborhoods[slug] ?? neighborhoods.bras;
  const [neighborhood, setNeighborhood] = useState(fallbackNeighborhood);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNeighborhood = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = unwrap(await neighborhoodsAPI.getById(slug ?? 'bras'));
      setNeighborhood(normalizeNeighborhood(data, fallbackNeighborhood));
    } catch {
      setNeighborhood(fallbackNeighborhood);
      setError('Nao foi possivel carregar o bairro do backend. Exibindo dados mockados.');
    } finally {
      setLoading(false);
    }
  }, [fallbackNeighborhood, slug]);

  useEffect(() => {
    loadNeighborhood();
  }, [loadNeighborhood]);

  return (
    <div className="bg-[#f8fafb] text-[#15191e]">
      {error ? (
        <section className="mx-auto my-4 flex w-[calc(100%-96px)] max-w-[1296px] flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f4b60d]/40 bg-[#fff6d6] px-5 py-3 text-[12px] font-semibold text-[#725600] max-md:w-[calc(100%-32px)]" aria-live="polite">
          <span>{error}</span>
          <button className="rounded-md bg-[#15191e] px-3 py-2 text-white" onClick={loadNeighborhood} type="button">Tentar novamente</button>
        </section>
      ) : null}
      <section className="relative flex min-h-[200px] items-center justify-between overflow-hidden bg-[#051c0e] px-20 py-7 text-white max-md:flex-col max-md:items-start max-md:px-6" aria-labelledby="bairro-title">
        <div className="absolute -left-20 -top-24 size-[280px] rounded-full bg-[#63a93a]/15" />
        <div className="absolute -right-20 -top-16 size-[300px] rounded-full bg-[#63a93a]/15" />
        <article className="relative">
          <a className="text-[13px] text-[#99d1ad]" href="/ranking">← Voltar ao Ranking</a>
          <p className="mt-3 flex items-center gap-3 text-[13px] text-[#c7ead1]">
            <span className="rounded-[14px] px-4 py-[7px] text-[11px] font-bold" style={{ background: neighborhood.scoreSoft, color: neighborhood.scoreColor }}>
              {neighborhood.badge}
            </span>
            Posicao {neighborhood.position} no Ranking
          </p>
          <h1 id="bairro-title" className="mt-2 text-[40px] font-extrabold leading-tight">{loading ? 'Carregando...' : neighborhood.name}</h1>
          <p className="mt-3 text-[16px] text-[#b7e0c4]">{neighborhood.city}</p>
        </article>
        <aside className="relative grid size-32 place-items-center rounded-full border-[3px] text-center shadow-[0_6px_24px_rgba(0,0,0,0.2)]" style={{ borderColor: neighborhood.scoreColor, background: neighborhood.scoreSoft, color: neighborhood.scoreColor }} aria-label={neighborhood.scoreLabel}>
          <strong className="mt-3 text-[36px] font-extrabold leading-none">{neighborhood.score}</strong>
          <span className="-mt-5 text-[13px]">/ 100</span>
          <small className="absolute top-[132px] min-w-[170px] text-[11px] text-[#b7e0c4] max-md:static" style={{ color: '#b7e0c4' }}>{neighborhood.scoreLabel}</small>
        </aside>
      </section>

      <section className="border border-[#e3e8ec] bg-white" aria-label="Indicadores do bairro">
        <dl className="mx-auto grid min-h-[88px] max-w-[1440px] grid-cols-6 items-center max-lg:grid-cols-3 max-md:grid-cols-1">
          {neighborhood.kpis.map(([value, label, helper, color]) => (
            <div className="border-r border-[#e3e8ec] px-9 py-4 last:border-r-0 max-md:border-r-0 max-md:border-b" key={label}>
              <dd className="text-[22px] font-bold" style={{ color }}>{value}</dd>
              <dt className="mt-1 text-[11px] text-[#48525f]">{label}</dt>
              <small className="text-[10px] text-[#8b96a3]">{helper}</small>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto my-7 grid w-[calc(100%-96px)] max-w-[1296px] grid-cols-[minmax(0,870px)_400px] gap-6 max-xl:grid-cols-1 max-md:w-[calc(100%-32px)]" aria-label="Analises do bairro">
        <div className="grid gap-5">
          <Panel title="Relatos por Categoria" subtitle="Distribuicao dos eventos registrados no bairro">
            <div className="mt-6 grid gap-3.5">
              {neighborhood.categories.map(([label, value, color]) => <HorizontalBar key={label} label={label} value={value} color={color} />)}
            </div>
          </Panel>

          <Panel title="Historico - Relatos x Investimento Mensal" subtitle="Ultimos 12 meses - 2024-2025">
            <MonthlyChart color={neighborhood.scoreColor} />
          </Panel>

          <Panel title={neighborhood.deficitTitle} subtitle="Valor investido vs. estimativa necessaria para infraestrutura">
            <div className="mt-6 grid gap-5">
              {deficit.map(([label, invested, required]) => <DeficitBar key={label} label={label} invested={invested} required={required} />)}
            </div>
          </Panel>
        </div>

        <aside className="grid gap-5" aria-label="Contexto lateral">
          <Panel title="Localizacao do Bairro">
            <figure className="mt-4">
              <MiniMap neighborhood={neighborhood} />
              <figcaption className="mt-2 text-[12px] text-[#8b96a3]">{neighborhood.coords}</figcaption>
            </figure>
          </Panel>

          <Panel title="Composicao da Pontuacao" subtitle={`Como o indice ${neighborhood.totalScore} foi calculado`}>
            <ScoreBreakdown neighborhood={neighborhood} />
          </Panel>

          <Panel title="Ultimos Relatos no Bairro">
            <ol className="mt-5 grid gap-4">
              {neighborhood.timeline.map(([category, title, time, status, color]) => (
                <li className="grid grid-cols-[14px_1fr_auto] gap-3" key={title}>
                  <span className="mt-1 size-3 rounded-full" style={{ background: color }} />
                  <article>
                    <span className="rounded-[10px] px-3 py-1 text-[10px] font-semibold" style={{ background: `${color}1f`, color }}>{category}</span>
                    <h3 className="mt-2 text-[13px] font-bold">{title}</h3>
                    <time className="text-[10px] text-[#8b96a3]">{time}</time>
                  </article>
                  <span className={`self-center rounded-[10px] px-2 py-1 text-[10px] font-bold ${statusClass[status]}`}>{status}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </section>

      <section className="mx-auto mb-16 w-[calc(100%-96px)] max-w-[1296px] max-md:w-[calc(100%-32px)]" aria-labelledby="related-title">
        <h2 id="related-title" className="border-b border-[#e3e8ec] pb-4 text-[18px] font-bold">Bairros Proximos - Compare a Vulnerabilidade</h2>
        <div className="mt-4 grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1">
          {related.map(([name, risk, score, meta, color, href]) => (
            <article className="rounded-xl border border-[#e3e8ec] border-t-4 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]" style={{ borderTopColor: color }} key={name}>
              <header className="flex justify-between"><h3 className="text-[15px] font-bold">{name}</h3><span className="rounded-[10px] px-2 py-1 text-[10px] font-bold" style={{ background: `${color}1f`, color }}>{risk}</span></header>
              <p className="mt-1 text-[12px] text-[#8b96a3]">{meta}</p>
              <div className="mt-3 h-2 rounded bg-[#eff3f5]"><span className="block h-2 rounded" style={{ width: `${score}%`, background: color }} /></div>
              <footer className="mt-2 flex justify-between text-[11px] font-bold" style={{ color }}><span>Score {score}</span><a href={href}>Ver →</a></footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <article className="rounded-xl border border-[#e3e8ec] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <header>
        <h2 className="text-[16px] font-bold">{title}</h2>
        {subtitle ? <p className="mt-1.5 text-[12px] text-[#8b96a3]">{subtitle}</p> : null}
      </header>
      {children}
    </article>
  );
}

function HorizontalBar({ label, value, color }) {
  return (
    <div className="grid grid-cols-[140px_1fr_42px] items-center gap-3 text-[12px] text-[#48525f] max-md:grid-cols-1">
      <span>{label}</span>
      <span className="h-5 rounded bg-[#eff3f5]"><span className="block h-5 rounded" style={{ width: `${value}%`, background: color }} /></span>
      <strong style={{ color }}>{value}%</strong>
    </div>
  );
}

function MonthlyChart({ color }) {
  const baseY = 204;
  const left = 34;
  const gap = 63;
  const chartHeight = 150;
  const points = monthly.map(([, , investment], index) => [left + index * gap + 18, baseY - (investment / 150) * chartHeight]);
  return (
    <svg className="mt-4 min-h-[250px] w-full" viewBox="0 0 820 250" role="img" aria-label="Grafico mensal de relatos e investimento">
      {[0, 50, 100, 150].map((tick) => {
        const y = baseY - (tick / 150) * chartHeight;
        return <g key={tick}><line x1="20" y1={y} x2="800" y2={y} stroke="#eff3f5" /><text x="0" y={y + 4} fill="#8b96a3" fontSize="10">{tick}</text></g>;
      })}
      {monthly.map(([month, reports], index) => {
        const x = left + index * gap;
        const h = (reports / 150) * chartHeight;
        return <g key={month}><rect x={x} y={baseY - h} width="36" height={h} rx="3" fill={color} /><text x={x + 18} y="229" textAnchor="middle" fill="#8b96a3" fontSize="9">{month}</text></g>;
      })}
      <polyline points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#2469d6" strokeWidth="2" />
      {points.map(([x, y]) => <circle cx={x} cy={y} r="4" fill="#2469d6" key={`${x}-${y}`} />)}
    </svg>
  );
}

function DeficitBar({ label, invested, required }) {
  const max = 100000;
  return (
    <div className="grid grid-cols-[150px_1fr] items-center gap-5 text-[12px] text-[#48525f] max-md:grid-cols-1">
      <span>{label}</span>
      <span className="relative h-5 overflow-hidden rounded bg-[#f3f6f7]">
        <span className="absolute inset-y-0 right-0 bg-[#fff0e6]" style={{ width: `${(required / max) * 100}%` }} />
        <span className="absolute inset-y-0 left-0 grid place-items-center end rounded bg-[#1a9651] pr-2 text-[10px] font-bold text-white" style={{ width: `${(invested / max) * 100}%` }}>R$ {Math.round(invested / 1000)}K</span>
        <span className="absolute right-2 top-1 text-[10px] text-[#f37d22]">R$ {Math.round(required / 1000)}K</span>
      </span>
    </div>
  );
}

function MiniMap({ neighborhood }) {
  const [x, y, width, height] = neighborhood.mapShape.rect.split(',').map(Number);
  const [cx, cy] = neighborhood.mapShape.circle;
  const [tx, ty] = neighborhood.mapShape.text;

  return (
    <svg className="w-full rounded-lg" viewBox="0 0 360 210" role="img" aria-label={`Mapa esquematico de ${neighborhood.name}`}>
      <rect width="360" height="210" rx="8" fill="#d8e5db" />
      <path d="M0 55H360M0 105H360M0 155H360M42 0V210M98 0V210M154 0V210M210 0V210M266 0V210M322 0V210" stroke="#f7fbf8" strokeWidth="3" />
      <polygon points="142,72 241,62 254,145 128,154" fill="#d8e9f5" />
      <rect x={x} y={y} width={width} height={height} rx="4" fill={`${neighborhood.scoreColor}14`} stroke={neighborhood.scoreColor} strokeWidth="3" />
      <circle cx={cx} cy={cy} r="17" fill={neighborhood.scoreColor} />
      <text x={tx} y={ty} textAnchor="middle" fill={neighborhood.scoreColor} fontSize="13" fontWeight="700">{neighborhood.mapLabel}</text>
    </svg>
  );
}

function ScoreBreakdown({ neighborhood }) {
  return (
    <div className="mt-5 grid gap-5">
      {neighborhood.scoreFactors.map(([label, weight, value, max, points, color]) => (
        <section key={label}>
          <header className="flex justify-between text-[11px] text-[#48525f]"><strong>{label}</strong><span>{weight}</span></header>
          <div className="mt-2 h-3 rounded bg-[#eff3f5]"><span className="block h-3 rounded" style={{ width: `${(value / max) * 100}%`, background: color }} /></div>
          <p className="mt-2 flex justify-between text-[10px] text-[#8b96a3]"><span>{value} / {max}</span><strong>+{points} pts</strong></p>
        </section>
      ))}
      <p className="flex justify-between border-t border-[#e3e8ec] pt-4 text-[12px] font-bold text-[#48525f]">
        Pontuacao Total
        <strong className="rounded-lg border-2 px-3 py-1" style={{ borderColor: neighborhood.scoreColor, background: neighborhood.scoreSoft, color: neighborhood.scoreColor }}>
          {neighborhood.totalScore}
        </strong>
      </p>
    </div>
  );
}
