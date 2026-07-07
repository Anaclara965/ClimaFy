import { Link } from 'react-router-dom';
import Badge from '../components/Badge.jsx';
import CategoryBadge from '../components/CategoryBadge.jsx';
import MapView from '../components/MapView.jsx';
import Pill from '../components/Pill.jsx';
import RankCard from '../components/RankCard.jsx';
import WeeklyReportsChart from '../components/WeeklyReportsChart.jsx';
import { categoryStyles, ranking, reports, stats } from '../utils/climafyData.js';

const steps = [
  {
    number: '01',
    title: 'Você vê o problema',
    description: 'Um alagamento, queimada, lixo ou risco climático aparece no seu caminho.',
    icon: (
      <path d="M12 3 4.5 20h15L12 3Zm0 5.2 3.9 8.8H8.1L12 8.2Z" fill="currentColor" />
    ),
  },
  {
    number: '02',
    title: 'Registra no mapa',
    description: 'Marque o ponto, escolha a categoria e conte rapidamente o que aconteceu.',
    icon: (
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" fill="currentColor" />
    ),
  },
  {
    number: '03',
    title: 'Dados são cruzados',
    description: 'Relatos da comunidade se conectam a investimento público e vulnerabilidade.',
    icon: (
      <path d="M5 5h5v5H5V5Zm9 0h5v5h-5V5ZM5 14h5v5H5v-5Zm9 0h5v5h-5v-5Z" fill="currentColor" />
    ),
  },
  {
    number: '04',
    title: 'Pressão por mudança',
    description: 'Bairros críticos ganham evidência para cobrar resposta e manutenção.',
    icon: (
      <path d="M4 13h4l3 7V4l-3 7H4v2Zm11-5.5v9a4.5 4.5 0 0 0 0-9Z" fill="currentColor" />
    ),
  },
];

function HeroSection() {
  return (
    <section className="relative mx-auto grid max-w-[1440px] gap-10 px-5 pb-[54px] pt-[74px] lg:grid-cols-[minmax(0,560px)_minmax(560px,1fr)] lg:px-[72px]">
      <div className="relative z-10">
        <p className="flex items-center gap-[10px] text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#1a9651]">
          <span className="h-2 w-2 rounded-full bg-[#1a9651]" />
          Monitoramento climático colaborativo
        </p>
        <h1 className="mt-[30px] max-w-[560px] text-[52px] font-extrabold leading-[58px] text-[#15191e] max-sm:text-[40px] max-sm:leading-[46px]">
          <span className="block">Seu bairro</span>
          <span className="block text-[#1a9651]">no mapa</span>
          <span className="block text-[#2469d6]">da mudança.</span>
        </h1>
        <p className="mt-6 max-w-[530px] text-[16px] leading-[23px] text-[#48525f]">
          Registre eventos climáticos, acompanhe áreas vulneráveis e transforme relatos da comunidade em dados para cobrar investimento público.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link className="grid h-14 min-w-[224px] place-items-center rounded-[28px] bg-[#116b38] px-7 text-[15px] font-bold text-white shadow-[0_12px_24px_rgba(17,107,56,0.22)] transition hover:bg-[#0d542c]" to="/cadastro">
            + Registrar um Evento
          </Link>
          <a className="grid h-14 min-w-[178px] place-items-center rounded-[28px] border-[1.5px] border-[#8b96a3] bg-white px-7 text-[15px] font-bold text-[#15191e] transition hover:border-[#1a9651] hover:text-[#1a9651]" href="#mapa">
            Ver o Mapa →
          </a>
        </div>
      </div>

      <MapView />
    </section>
  );
}

function MetricsSection() {
  return (
    <section className="relative overflow-hidden bg-[#15191e]">
      <div className="absolute -left-24 -top-32 h-64 w-64 rounded-full bg-[#1a9651]/20" />
      <div className="absolute -bottom-36 -right-16 h-72 w-72 rounded-full bg-[#2469d6]/16" />
      <div className="relative mx-auto grid max-w-[1440px] grid-cols-2 px-5 py-8 sm:grid-cols-3 lg:h-[148px] lg:grid-cols-5 lg:px-[72px] lg:py-0">
        {stats.map((stat) => (
          <div className="flex flex-col items-center justify-center border-[#262d36] px-4 text-center lg:border-r last:border-r-0" key={stat.label}>
            <strong className="text-[30px] font-extrabold leading-none text-[#1a9651]">{stat.value}</strong>
            <span className="mt-2 text-[12px] font-bold leading-[15px] text-white">{stat.label}</span>
            <span className="mt-1 text-[9px] leading-[12px] text-[#8b96a3]">{stat.helper}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-[54px] lg:px-[72px]">
      <div className="max-w-[560px]">
        <Pill>Como funciona</Pill>
        <h2 className="mt-4 text-[32px] font-extrabold leading-[38px] text-[#15191e]">Quatro passos para transformar alerta em ação</h2>
        <p className="mt-3 text-[14px] leading-5 text-[#66717f]">A experiência foi pensada para ser rápida no celular e útil para quem precisa comparar bairros.</p>
      </div>

      <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <article className="relative rounded-[14px] border border-[#e3e8ec] bg-white p-5 shadow-[0_10px_30px_rgba(21,25,30,0.06)]" key={step.number}>
            {index < steps.length - 1 ? <span className="absolute -right-5 top-1/2 hidden h-px w-5 bg-[#b7c5cf] xl:block" /> : null}
            {index < steps.length - 1 ? <span className="absolute -right-[21px] top-1/2 hidden h-2 w-2 -translate-y-1/2 rotate-45 border-r border-t border-[#b7c5cf] xl:block" /> : null}
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold text-[#1a9651]">{step.number}</span>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e0f5e9] text-[#1a9651]">
                <svg className="h-5 w-5" viewBox="0 0 24 24">{step.icon}</svg>
              </span>
            </div>
            <h3 className="mt-5 text-[16px] font-extrabold leading-5 text-[#15191e]">{step.title}</h3>
            <p className="mt-2 text-[12px] leading-[17px] text-[#48525f]">{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function RankingPreviewSection() {
  return (
    <section className="border-y border-[#e3e8ec] bg-white">
      <div className="mx-auto grid max-w-[1440px] gap-[42px] px-5 py-[54px] lg:grid-cols-[300px_1fr] lg:px-[72px]">
        <div>
          <Pill>Ranking de vulnerabilidade</Pill>
          <h2 className="mt-4 text-[32px] font-extrabold leading-[38px] text-[#15191e]">Bairros que precisam de atenção agora</h2>
          <p className="mt-4 text-[14px] leading-5 text-[#66717f]">Relatos da comunidade cruzados com dados públicos criam uma leitura objetiva de risco e investimento.</p>
          <Link className="mt-8 inline-grid h-11 place-items-center rounded-lg bg-[#1a9651] px-5 text-[13px] font-bold text-white transition hover:bg-[#116b38]" to="/ranking">
            Ver ranking completo →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {ranking.map((item) => (
            <RankCard item={item} key={item.neighborhood} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportCard({ report }) {
  const color = categoryStyles[report.category]?.color ?? '#1a9651';

  return (
    <article className="overflow-hidden rounded-[14px] border border-[#e3e8ec] bg-white shadow-[0_10px_30px_rgba(21,25,30,0.06)]">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="flex h-[212px] flex-col p-[15px]">
        <div className="flex items-start justify-between gap-3">
          <CategoryBadge categoria={report.category} />
          <span className="text-[10px] font-semibold leading-3 text-[#8b96a3]">{report.neighborhood}</span>
        </div>
        <h3 className="mt-3 text-[14px] font-extrabold leading-[18px] text-[#15191e]">{report.title}</h3>
        <p className="mt-2 flex-1 text-[11px] leading-4 text-[#48525f]">{report.description}</p>
        <div className="mt-3 flex items-center justify-between border-t border-[#e3e8ec] pt-3 text-[10px] text-[#8b96a3]">
          <Badge type={report.status} />
          <span>{report.time}</span>
          <span className="font-bold text-[#48525f]">▲ {report.votes}</span>
        </div>
      </div>
    </article>
  );
}

function LatestReportsSection() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-[54px] lg:px-[72px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Pill>Últimos relatos</Pill>
          <h2 className="mt-4 text-[32px] font-extrabold leading-[38px] text-[#15191e]">Registrados agora pela comunidade</h2>
        </div>
        <Link className="grid h-10 place-items-center rounded-lg border border-[#1a9651] px-5 text-[13px] font-bold text-[#1a9651] transition hover:bg-[#e0f5e9]" to="/relatos">
          Ver todos →
        </Link>
      </div>

      <div className="mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </section>
  );
}

function ActivitySection() {
  return (
    <section className="border-y border-[#e3e8ec] bg-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-[54px] lg:grid-cols-[320px_1fr] lg:px-[72px]">
        <div>
          <Pill>Atividade recente</Pill>
          <h2 className="mt-4 text-[32px] font-extrabold leading-[38px] text-[#15191e]">Relatos dos últimos 7 dias</h2>
          <p className="mt-4 text-[14px] leading-5 text-[#66717f]">Volume total comparado aos casos resolvidos pela rede de acompanhamento.</p>
        </div>
        <WeeklyReportsChart />
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden bg-[#15191e] px-5 py-[62px] text-center text-white">
      <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-[#1a9651]/24" />
      <div className="absolute -bottom-28 -right-16 h-[300px] w-[300px] rounded-full bg-[#2469d6]/16" />
      <div className="relative mx-auto max-w-[760px]">
        <h2 className="text-[34px] font-extrabold leading-[42px]">Viu um risco climático no seu bairro?</h2>
        <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-6 text-[#c7d1dc]">Seu relato ajuda a revelar prioridades, acompanhar soluções e pressionar por manutenção onde a cidade mais precisa.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link className="grid h-12 min-w-[218px] place-items-center rounded-xl bg-[#1a9651] px-6 text-[14px] font-bold text-white transition hover:bg-[#116b38]" to="/novo-relato">
            + Registrar um Evento
          </Link>
          <a className="grid h-12 min-w-[178px] place-items-center rounded-xl border border-[#63a93a] px-6 text-[14px] font-bold text-white transition hover:bg-white/10" href="#mapa">
            Ver o Mapa →
          </a>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="overflow-hidden bg-[#f8fafb]">
      <HeroSection />
      <MetricsSection />
      <HowItWorksSection />
      <RankingPreviewSection />
      <LatestReportsSection />
      <ActivitySection />
      <FinalCtaSection />
    </div>
  );
}