import { useCallback, useEffect, useState } from 'react';
import ClimateMap from '../components/ClimateMap.jsx';
import ReportCard from '../components/ReportCardFigma.jsx';
import WeeklyReportsChart from '../components/WeeklyReportsChart.jsx';
import { useClimateReports } from '../hooks/useClimateReports.js';
import { neighborhoodsAPI, rankingAPI, unwrap } from '../services/api.js';
import { ranking as fallbackRanking, stats as fallbackStats } from '../utils/climafyData.js';

const steps = [
  ['01', 'Registre o Evento', 'Clique no mapa, marque o local exato e preencha um formulario rapido com foto. Leva menos de 2 minutos.'],
  ['02', 'Moderacao em 24h', 'Nossa equipe analisa a publicacao e valida as informacoes antes de aparecer no mapa.'],
  ['03', 'Pressao Publica', 'Bairros com mais relatos ganham destaque e viram pauta para imprensa e governo.'],
  ['04', 'Resolucao Rastreada', 'Acompanhe o status de cada evento: aberto, em andamento ou resolvido.'],
];

const purposeCards = [
  ['01', 'Monitoramento hiperlocal', 'Registrar e visualizar eventos climaticos e impactos ambientais no nivel do bairro e da rua, cobrindo a lacuna dos dados oficiais.'],
  ['02', 'Comunidade ativa', 'Transformar moradores em agentes ativos de mudanca, criando uma rede colaborativa de monitoramento de baixo custo.'],
  ['03', 'Investimento publico', 'Cruzar relatos da populacao com portais de transparencia, gerando um ranking publico de vulnerabilidade urbana.'],
  ['04', 'Justica climatica', 'Direcionar atencao e investimento para comunidades onde o risco climatico e mais critico.'],
];

const normalizeRankingPreview = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.ranking ?? payload?.items ?? [];

  return items.slice(0, 3).map((item, index) => ({
    position: item.position ?? item.rank ?? index + 1,
    neighborhood: item.neighborhood?.name ?? item.neighborhood ?? item.name ?? item.bairro ?? 'Bairro',
    score: item.score ?? item.riskScore ?? item.reports ?? 0,
    investment: typeof item.investment === 'string' ? item.investment : `R$ ${Math.round((item.investment ?? 0) / 1000)}K`,
    risk: item.risk ?? item.classification ?? 'alta',
    trend: item.trend ?? '+0',
  }));
};

export default function HomeFigma() {
  const { reports, loading: reportsLoading, error: reportsError, retry: retryReports } = useClimateReports();
  const [mapData, setMapData] = useState(null);
  const [homeStats, setHomeStats] = useState(fallbackStats);
  const [homeRanking, setHomeRanking] = useState(fallbackRanking);
  const [loadingHome, setLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState('');

  const loadHomeData = useCallback(async () => {
    setLoadingHome(true);
    setHomeError('');

    const [mapResult, rankingResult] = await Promise.allSettled([
      neighborhoodsAPI.mapData(),
      rankingAPI.list({ limit: 3 }),
    ]);

    if (mapResult.status === 'fulfilled') {
      const data = unwrap(mapResult.value);
      setMapData(data);
      if (Array.isArray(data?.stats)) setHomeStats(data.stats);
    } else {
      setMapData(null);
      setHomeStats(fallbackStats);
      setHomeError('Nao foi possivel carregar o mapa do backend. Exibindo dados mockados.');
    }

    if (rankingResult.status === 'fulfilled') {
      const nextRanking = normalizeRankingPreview(unwrap(rankingResult.value));
      setHomeRanking(nextRanking.length ? nextRanking : fallbackRanking);
    } else {
      setHomeRanking(fallbackRanking);
      setHomeError((message) => message || 'Nao foi possivel carregar o ranking do backend. Exibindo dados mockados.');
    }

    setLoadingHome(false);
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  return (
    <div className="overflow-hidden bg-[#f8fafb]">
      <section className="relative mx-auto min-h-[626px] max-w-[1440px] px-5 lg:px-0">
        <div className="pt-[74px] lg:absolute lg:left-[72px] lg:top-0 lg:w-[600px]">
          <p className="flex items-center gap-[10px] text-[12px] font-bold uppercase leading-[15px] text-[#1a9651]">
            <span className="h-2 w-2 rounded-full bg-[#1a9651]" />
            Monitoramento climatico comunitario
          </p>
          <h1 className="mt-[34px] max-w-[540px] text-[48px] font-extrabold leading-[56px] text-[#15191e] max-sm:text-[40px] max-sm:leading-[46px]">
            O seu bairro nao pode <span className="text-[#1a9651]">esperar</span> mais.
          </h1>
          <p className="mt-[24px] max-w-[540px] text-[16px] leading-[20px] text-[#48525f]">
            Enquanto os dados oficiais olham so para a cidade como um todo, o alagamento e na sua rua. O ClimaFy transforma cada relato de morador em pressao real por investimento - rua por rua, bairro por bairro.
          </p>
          <div className="mt-[78px] flex flex-wrap gap-4">
            <a className="grid h-14 w-[280px] place-items-center rounded-[28px] bg-[#116b38] text-[15px] font-semibold text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)]" href="/novo-relato">
              Relatar um problema agora
            </a>
            <a className="grid h-14 w-[230px] place-items-center rounded-[28px] border-[1.5px] border-[#8b96a3] bg-white text-[15px] font-semibold text-[#15191e]" href="/ranking">
              Ver bairros esquecidos
            </a>
          </div>
        </div>
        <div className="mt-10 lg:absolute lg:left-[662px] lg:top-[80px] lg:mt-0 lg:w-[698px] max-md:-mx-5">
          {loadingHome ? <SkeletonBlock className="h-[460px] max-md:h-[calc(100vh-120px)]" /> : <ClimateMap data={mapData} />}
        </div>
      </section>

      {(homeError || reportsError) ? (
        <section className="mx-auto my-4 flex max-w-[1296px] flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f4b60d]/40 bg-[#fff6d6] px-5 py-3 text-[12px] font-semibold text-[#725600]" aria-live="polite">
          <span>{homeError || reportsError}</span>
          <button className="rounded-md bg-[#15191e] px-3 py-2 text-white" onClick={() => { loadHomeData(); retryReports(); }} type="button">Tentar novamente</button>
        </section>
      ) : null}

      <section className="bg-[#15191e]">
        <div className="mx-auto grid h-auto max-w-[1440px] grid-cols-2 px-[72px] py-6 sm:grid-cols-3 lg:h-[148px] lg:grid-cols-5 lg:py-0 max-md:px-5">
          {homeStats.map((stat) => (
            <div className="flex flex-col items-center justify-center border-[#262d36] px-4 text-center lg:border-r last:border-r-0" key={stat.label}>
              <strong className="text-[28px] font-extrabold leading-[34px] text-[#1a9651]">{stat.value}</strong>
              <span className="mt-1 text-[12px] font-semibold leading-[15px] text-white">{stat.label}</span>
              <span className="mt-[2px] text-[9px] leading-[11px] text-[#8b96a3]">{stat.helper}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-[72px] py-[44px] max-md:px-5">
        <p className="inline-flex h-[26px] items-center rounded-[13px] bg-[#e0f5e9] px-3 text-[10px] font-semibold uppercase text-[#1a9651]">Como funciona</p>
        <h2 className="mt-3 text-[30px] font-bold leading-[36px] text-[#15191e]">Simples, rapido e com impacto real</h2>
        <p className="mt-2 text-[13px] leading-[16px] text-[#8b96a3]">Qualquer cidadao pode contribuir. Sem burocracia, sem conhecimento tecnico.</p>
        <div className="mt-[34px] grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {steps.map(([number, title, description]) => (
            <article className="h-[176px] rounded-lg border border-[#e3e8ec] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]" key={number}>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e0f5e9] text-[12px] font-bold text-[#1a9651]">{number}</span>
              <h3 className="mt-[14px] text-[14px] font-bold leading-[17px] text-[#15191e]">{title}</h3>
              <p className="mt-2 text-[11px] leading-[16px] text-[#48525f]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ranking" className="border-y border-[#e3e8ec] bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-[42px] px-[72px] py-[42px] lg:grid-cols-[270px_1fr] max-md:px-5">
          <div>
            <p className="inline-flex h-[26px] items-center rounded-[13px] bg-[#e0f5e9] px-3 text-[10px] font-semibold uppercase text-[#1a9651]">Ranking de vulnerabilidade</p>
            <h2 className="mt-4 text-[30px] font-bold leading-[36px] text-[#15191e]">Os bairros que mais precisam de atencao</h2>
            <p className="mt-4 text-[13px] leading-[16px] text-[#8b96a3]">Relatos da comunidade cruzados com dados publicos de investimento geram um score de risco por bairro.</p>
            <a className="mt-[58px] inline-grid h-10 w-[196px] place-items-center rounded-lg bg-[#1a9651] text-[13px] font-semibold text-white" href="/ranking">
              Ver ranking completo +
            </a>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {homeRanking.map((item) => (
              <article className="h-[382px] rounded-[14px] border border-[#e3e8ec] bg-[#f8fafb] p-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.08)]" key={item.neighborhood}>
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#15191e] text-[12px] font-bold text-white">#{item.position}</span>
                  <span className="rounded-[10px] bg-red-50 px-3 py-[5px] text-[10px] font-semibold uppercase text-[#d62727]">{item.risk}</span>
                </div>
                <h3 className="mt-8 text-[20px] font-bold leading-6 text-[#15191e]">{item.neighborhood}</h3>
                <p className="mt-[6px] text-[11px] leading-[14px] text-[#8b96a3]">Sao Paulo, SP</p>
                <div className="mt-[18px] h-2 rounded-full bg-[#e3e8ec]">
                  <div className="h-2 rounded-full bg-[#d62727]" style={{ width: `${Math.min(item.score, 150) / 1.5}%` }} />
                </div>
                <div className="mt-[24px] flex justify-between">
                  <div>
                    <span className="text-[28px] font-extrabold leading-[34px]">{item.score}</span>
                    <p className="text-[10px] leading-[13px] text-[#8b96a3]">Indice de risco</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[20px] font-bold leading-6">{item.investment}</span>
                    <p className="text-[10px] leading-[13px] text-[#8b96a3]">Investimento 2025</p>
                  </div>
                </div>
                <p className="mt-8 text-[10px] text-[#8b96a3]">Tendencia esta semana <span className="font-semibold text-[#d62727]">{item.trend}</span></p>
                <a className="mt-[21px] grid h-10 w-full place-items-center rounded-lg border border-[#1a9651] bg-white text-[12px] font-semibold text-[#1a9651]" href={item.neighborhood === 'Bras' ? '/bairro/bras' : item.neighborhood === 'Pinheiros' ? '/bairro/pinheiros' : '#mapa'}>
                  Ver detalhes do bairro +
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="relatos" className="mx-auto max-w-[1440px] px-[72px] py-[42px] max-md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex h-[26px] items-center rounded-[13px] bg-[#e0f5e9] px-3 text-[10px] font-semibold uppercase text-[#1a9651]">Ultimos relatos</p>
            <h2 className="mt-4 text-[30px] font-bold leading-[36px] text-[#15191e]">Registrados agora pela comunidade</h2>
          </div>
          <a className="grid h-10 w-[196px] place-items-center rounded-lg border border-[#1a9651] text-[13px] font-semibold text-[#1a9651]" href="/relatos">Ver todos os relatos +</a>
        </div>
        <div className="mt-[34px] grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {reportsLoading ? Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock className="h-[204px]" key={index} />
          )) : reports.map((report) => (
            <ReportCard key={report.title} report={report} />
          ))}
        </div>
      </section>

      <section className="border-y border-[#e3e8ec] bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-[72px] py-[44px] lg:grid-cols-[320px_1fr] max-md:px-5">
          <div>
            <p className="inline-flex h-[26px] items-center rounded-[13px] bg-[#e0f5e9] px-3 text-[10px] font-semibold uppercase text-[#1a9651]">Atividade recente</p>
            <h2 className="mt-3 text-[30px] font-bold leading-[36px] text-[#15191e]">Relatos registrados nos ultimos 7 dias</h2>
            <p className="mt-4 text-[13px] leading-[16px] text-[#8b96a3]">Acompanhe o volume diario de relatos e a taxa de resolucao.</p>
          </div>
          <WeeklyReportsChart />
        </div>
      </section>

      <section id="sobre" className="border-y border-[#e3e8ec] bg-[#f8fafb]">
        <div className="mx-auto max-w-[1440px] px-[72px] py-[44px] max-md:px-5">
          <p className="inline-flex h-[26px] items-center rounded-[13px] bg-[#e0f5e9] px-3 text-[10px] font-semibold uppercase text-[#1a9651]">Missao, objetivos e valores</p>
          <h2 className="mt-3 text-[30px] font-bold leading-[36px] text-[#15191e]">Proposito e compromisso</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {purposeCards.map(([number, title, text]) => (
              <article className="h-[185px] rounded-[14px] border border-[#e3e8ec] bg-white p-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" key={number}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#15191e] text-[12px] font-bold text-white">{number}</span>
                <h3 className="mt-3 text-[20px] font-bold leading-6 text-[#15191e]">{title}</h3>
                <p className="mt-2 text-[12px] leading-4 text-[#48525f]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="relatar" className="relative overflow-hidden bg-[#116b38] px-5 py-9 text-center text-white">
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[#1a9651]/35" />
        <div className="absolute -right-20 -top-16 h-[280px] w-[280px] rounded-full bg-[#1a9651]/35" />
        <h2 className="relative text-[32px] font-bold leading-10">Viu algo errado na sua cidade?</h2>
        <p className="relative mt-3 text-[14px] leading-[17px] text-[#c7ead1]">Seu relato pode mudar a realidade do seu bairro. Registre agora - e gratuito e leva 2 minutos.</p>
        <div className="relative mt-5 flex flex-wrap justify-center gap-5">
          <a className="grid h-12 w-56 place-items-center rounded-xl border-2 border-[#63a93a] bg-[#1a9651] text-[14px] font-semibold text-white" href="/novo-relato">
            + Registrar um Evento
          </a>
          <a className="grid h-12 w-56 place-items-center rounded-xl bg-white text-[14px] font-semibold text-[#116b38]" href="#mapa">
            Ver o Mapa Interativo +
          </a>
        </div>
      </section>

      <footer className="bg-[#15191e] px-12 py-5 text-[13px] text-[#8b96a3]">
        <div className="mx-auto flex max-w-[1344px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <strong className="text-[16px] text-[#1a9651]">ClimaFy</strong>
            <p className="mt-1 text-[12px]">Plataforma de Monitoramento Climatico Comunitario</p>
          </div>
          <nav className="flex flex-wrap gap-[54px]">
            <a href="#mapa">Inicio</a>
            <a href="/ranking">Ranking</a>
            <a href="/relatos">Relatos</a>
            <a href="/sobre">Sobre</a>
          </nav>
          <span className="text-[11px] text-[#48525f]">(c) ClimaFy 2026</span>
        </div>
      </footer>
    </div>
  );
}

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-[14px] bg-[#e3e8ec] ${className}`} aria-label="Carregando" />;
}
