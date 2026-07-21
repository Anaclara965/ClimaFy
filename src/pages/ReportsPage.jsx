import { useCallback, useEffect, useMemo, useState } from 'react';
import ReportCard from '../components/ReportCard.jsx';
import { reportsAPI, unwrap } from '../services/api.js';

const fallbackReports = [
  { id: 1, category: 'Alagamento', neighborhood: 'Vila Madalena', title: 'Rua das Flores completamente alagada', description: "Nivel d'agua subiu 40cm apos 30min de chuva. Drenos obstruidos ha semanas.", status: 'Aberto', time: 'Ha 2 horas', votes: 34, color: '#2469d6', period: '24 horas' },
  { id: 2, category: 'Queimada', neighborhood: 'Bras', title: 'Foco de queimada proximo a linha ferrea', description: 'Fumaca intensa visivel a 2km. Bombeiros acionados mas sem resposta ainda.', status: 'Em andamento', time: 'Ha 4 horas', votes: 67, color: '#d62727', period: '24 horas' },
  { id: 3, category: 'Calor Extremo', neighborhood: 'Consolacao', title: 'Ponto de hidratacao desativado na praca', description: 'Com 38 graus, o ponto de apoio montado pela prefeitura foi retirado sem aviso previo.', status: 'Aberto', time: 'Ha 6 horas', votes: 29, color: '#f35c22', period: '24 horas' },
  { id: 4, category: 'Lixo Irregular', neighborhood: 'Mooca', title: 'Descarte irregular de entulho na Av. Paes', description: 'Toneladas de residuos de construcao bloqueando parcialmente a calcada.', status: 'Aberto', time: 'Ha 1 dia', votes: 18, color: '#8b6328', period: '7 dias' },
  { id: 5, category: 'Alagamento', neighborhood: 'Butanta', title: 'Corrego transbordando para rua residencial', description: 'Moradores isolados. Agua invadiu garagens. Situacao critica.', status: 'Em andamento', time: 'Ha 1 dia', votes: 51, color: '#2469d6', period: '7 dias' },
  { id: 6, category: 'Arvore Caida', neighborhood: 'Oscar', title: 'Arvore de grande porte caida na Rua Oscar', description: 'Bloqueia 70% da via. Risco de dano ao poste de energia.', status: 'Resolvido', time: 'Ha 2 dias', votes: 12, color: '#63a93a', period: '7 dias' },
  { id: 7, category: 'Poluicao Agua', neighborhood: 'Tatuape', title: 'Esgoto a ceu aberto na Rua Tavares', description: 'Vazamento de esgoto ha mais de 2 dias. Cheiro forte e risco sanitario.', status: 'Aberto', time: 'Ha 3 dias', votes: 23, color: '#16a3a3', period: '7 dias' },
  { id: 8, category: 'Calor Extremo', neighborhood: 'Perdizes', title: 'Escola sem ar-condicionado com 37 graus', description: 'Criancas passaram mal. Professores relatam temperatura insuportavel em salas.', status: 'Aberto', time: 'Ha 4 dias', votes: 40, color: '#f35c22', period: '30 dias' },
  { id: 9, category: 'Queimada', neighborhood: 'Lapa', title: 'Area verde no Corrego Sapateiro queimando', description: 'Vegetacao em chamas ao lado de residencias. Vento espalhando faiscas.', status: 'Resolvido', time: 'Ha 5 dias', votes: 76, color: '#d62727', period: '30 dias' },
];

const categoryDistribution = [
  ['Alagamento', 40, '#2469d6'],
  ['Calor Extremo', 24, '#f35c22'],
  ['Queimada', 18, '#d62727'],
  ['Lixo Irregular', 11, '#8b6328'],
  ['Arvore Caida', 7, '#63a93a'],
  ['Poluicao Agua', 2, '#16a3a3'],
];

const neighborhoodRanking = [
  ['Bras', 147, 'CRITICA', '#d62727'],
  ['Vila Madalena', 118, 'CRITICA', '#d62727'],
  ['Pinheiros', 94, 'ALTA', '#f37d22'],
  ['Mooca', 82, 'ALTA', '#f37d22'],
  ['Consolacao', 61, 'MEDIA', '#f4b60d'],
  ['Butanta', 55, 'MEDIA', '#f4b60d'],
  ['Perdizes', 28, 'BAIXA', '#1a9651'],
  ['Lapa', 19, 'BAIXA', '#1a9651'],
];

const statusTabs = ['Todos', 'Aberto', 'Em andamento', 'Resolvido'];

const normalizeReports = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.reports ?? payload?.items ?? [];

  return items.map((report, index) => ({
    id: report.id ?? report._id ?? index + 1,
    category: report.category ?? report.type ?? 'Alagamento',
    neighborhood: report.neighborhood?.name ?? report.neighborhood ?? report.bairro ?? 'Bairro',
    title: report.title ?? report.titulo ?? 'Relato da comunidade',
    description: report.description ?? report.descricao ?? report.summary ?? '',
    status: report.status ?? 'Aberto',
    time: report.time ?? report.createdAgo ?? report.created_at ?? 'Agora',
    votes: report.votes ?? report.upvotes ?? 0,
    color: report.color ?? report.categoryColor,
    tone: report.tone,
    period: report.period ?? '7 dias',
  }));
};

export default function ReportsPage() {
  const [status, setStatus] = useState('Todos');
  const [category, setCategory] = useState('Categoria');
  const [neighborhood, setNeighborhood] = useState('Bairro');
  const [period, setPeriod] = useState('Periodo');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [reports, setReports] = useState(fallbackReports);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categories = [...new Set(reports.map((report) => report.category))];
  const neighborhoods = [...new Set(reports.map((report) => report.neighborhood))];

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        status: status === 'Todos' ? undefined : status,
        category: category === 'Categoria' ? undefined : category,
        neighborhood: neighborhood === 'Bairro' ? undefined : neighborhood,
        period: period === 'Periodo' ? undefined : period,
        search: search || undefined,
        sort,
      };
      const data = unwrap(await reportsAPI.list(params));
      const nextReports = normalizeReports(data);
      setReports(nextReports.length ? nextReports : fallbackReports);
    } catch {
      setReports(fallbackReports);
      setError('Nao foi possivel carregar os relatos do backend. Exibindo dados mockados.');
    } finally {
      setLoading(false);
    }
  }, [category, neighborhood, period, search, sort, status]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filtered = useMemo(() => {
    const items = reports.filter((report) => {
      const statusMatch = status === 'Todos' || report.status === status;
      const categoryMatch = category === 'Categoria' || report.category === category;
      const neighborhoodMatch = neighborhood === 'Bairro' || report.neighborhood === neighborhood;
      const periodMatch = period === 'Periodo' || report.period === period;
      const searchMatch = !search || `${report.title} ${report.description} ${report.neighborhood}`.toLowerCase().includes(search.toLowerCase());
      return statusMatch && categoryMatch && neighborhoodMatch && periodMatch && searchMatch;
    });

    if (sort === 'votes') return [...items].sort((a, b) => b.votes - a.votes);
    if (sort === 'oldest') return [...items].sort((a, b) => a.id - b.id);
    return [...items].sort((a, b) => b.id - a.id);
  }, [category, neighborhood, period, search, sort, status]);

  const maxNeighborhood = Math.max(...neighborhoodRanking.map((item) => item[1]));
  const featured = [...reports].sort((a, b) => b.votes - a.votes).slice(0, 2);

  return (
    <div className="bg-[#f8fafb] text-[#15191e]">
      <section className="grid min-h-20 grid-cols-[1fr_500px] items-center gap-10 bg-[#116b38] px-20 py-3 text-white max-lg:grid-cols-1 max-md:px-6" aria-labelledby="reports-title">
        <article>
          <h1 id="reports-title" className="text-[24px] font-bold">Relatos da Comunidade</h1>
          <p className="mt-1.5 text-[13px] text-[#c7ead1]">Acompanhe eventos climaticos e ambientais registrados por cidadaos.</p>
        </article>
        <dl className="grid grid-cols-3 gap-8 max-sm:grid-cols-1">
          {[
            ['1.247', 'Total'],
            ['312', 'Resolvidos'],
            ['48', 'Bairros'],
          ].map(([value, label]) => (
            <div className="flex flex-col border-[#33734d] first:border-l-0 sm:border-l sm:pl-8" key={label}>
              <dt className="order-2 mt-1 text-[11px] text-[#c7ead1]">{label}</dt>
              <dd className="order-1 text-[22px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border border-[#e3e8ec] bg-white px-[72px] py-[15px] max-md:px-6" aria-label="Filtros de relatos">
        <form className="grid grid-cols-[auto_180px_180px_160px_167px] items-center gap-3 max-xl:grid-cols-1">
          <fieldset className="flex items-center gap-2 border-0 max-sm:flex-wrap">
            <legend className="mr-4 text-[13px] font-medium text-[#48525f]">Filtrar:</legend>
            {statusTabs.map((tab) => (
              <button className={`h-8 rounded-lg px-3 text-[12px] ${status === tab ? 'bg-[#1a9651] font-semibold text-white' : 'bg-[#eff3f5] text-[#48525f]'}`} type="button" onClick={() => setStatus(tab)} key={tab}>
                {tab === 'Em andamento' ? 'Em Andamento' : tab}
              </button>
            ))}
          </fieldset>
          <select className="h-8 rounded-lg border border-[#d1d8de] px-3 text-[12px] text-[#48525f]" value={category} onChange={(event) => setCategory(event.target.value)}><option>Categoria</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="h-8 rounded-lg border border-[#d1d8de] px-3 text-[12px] text-[#48525f]" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option>Bairro</option>{neighborhoods.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="h-8 rounded-lg border border-[#d1d8de] px-3 text-[12px] text-[#48525f]" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Periodo</option><option>24 horas</option><option>7 dias</option><option>30 dias</option></select>
          <input className="h-8 rounded-lg border border-[#d1d8de] bg-[#f8fafb] px-3 text-[12px] outline-none placeholder:text-[#8b96a3]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." type="search" />
        </form>
      </section>

      <section className="mx-auto mt-5 flex w-[calc(100%-96px)] max-w-[1296px] items-center justify-between text-[14px] text-[#8b96a3] max-md:w-[calc(100%-32px)] max-md:flex-col max-md:items-start max-md:gap-3" aria-label="Resultado e ordenacao">
        <p>{filtered.length} relatos encontrados</p>
        <select className="h-8 w-[167px] rounded-lg border border-[#d1d8de] bg-white px-3 text-[12px] text-[#48525f]" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="recent">Mais recentes</option>
          <option value="votes">Mais votados</option>
          <option value="oldest">Mais antigos</option>
        </select>
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadReports} /> : null}

      <section className="mx-auto mt-4 w-[calc(100%-96px)] max-w-[1296px] max-md:w-[calc(100%-32px)]" aria-labelledby="cards-title">
        <h2 id="cards-title" className="sr-only">Lista de relatos</h2>
        <div className="grid grid-cols-3 gap-7 max-lg:grid-cols-2 max-md:grid-cols-1">
          {loading ? Array.from({ length: 9 }).map((_, index) => <SkeletonCard key={index} />) : filtered.map((report) => <ReportCard key={report.id} report={report} />)}
        </div>
        <nav className="my-7 flex justify-center gap-2 text-[11px]" aria-label="Paginacao dos relatos">
          {['←', '1', '2', '3', '...', '12', '→'].map((item) => <a className={`grid h-6 min-w-6 place-items-center rounded-md border border-[#e3e8ec] ${item === '1' ? 'bg-[#1a9651] text-white' : 'bg-white text-[#8b96a3]'}`} href="#" key={item}>{item}</a>)}
        </nav>
      </section>

      <section className="bg-[#15191e]">
        <dl className="mx-auto grid min-h-[150px] max-w-[1296px] grid-cols-5 items-center text-center max-lg:grid-cols-3 max-md:grid-cols-1">
          {[
            ['1.247', 'Relatos Ativos', 'Em aberto agora'],
            ['312', 'Resolvidos no mes', '+21% este mes'],
            ['89', 'Em Andamento', 'Sob verificacao'],
            ['4h', 'Tempo medio', 'Primeira resposta'],
            ['98%', 'Taxa de aprovacao', 'Validacao comunitaria'],
          ].map(([value, label, helper]) => <div className="py-6" key={label}><dd className="text-[24px] font-bold text-[#1a9651]">{value}</dd><dt className="text-[10px] text-[#c7ead1]">{label}</dt><small className="text-[10px] text-[#8b96a3]">{helper}</small></div>)}
        </dl>
      </section>

      <section className="mx-auto grid max-w-[1296px] grid-cols-[330px_1fr] gap-10 px-6 py-14 max-lg:grid-cols-1" aria-labelledby="featured-title">
        <SectionCopy pill="Relatos em destaque" title="Os casos mais votados pela comunidade" id="featured-title" action="Ver todos os relatos" href="/relatos" />
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          {featured.map((report) => <FeaturedCard report={report} key={report.id} />)}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1296px] grid-cols-[330px_1fr] gap-10 px-6 py-14 max-lg:grid-cols-1" aria-labelledby="distribution-title">
        <SectionCopy pill="Analise de categorias" title="O que a comunidade mais reporta?" id="distribution-title" />
        <div className="grid gap-[18px]">
          {categoryDistribution.map(([name, percent, color]) => <HorizontalBar key={name} name={name} percent={percent} color={color} />)}
        </div>
      </section>

      <section className="mx-auto max-w-[1296px] px-6 py-14" aria-labelledby="voices-title">
        <p className="inline-flex h-[26px] items-center rounded-[13px] bg-[#e0f5e9] px-3 text-[10px] font-bold uppercase text-[#1a9651]">Vozes da comunidade</p>
        <h2 id="voices-title" className="mt-3 text-[28px] font-bold">O que dizem quem ja relatou</h2>
        <div className="mt-8 grid grid-cols-3 gap-7 max-md:grid-cols-1">
          {['Recebi a ligacao da equipe no mesmo dia. Nosso alagamento finalmente entrou no mapa.', 'Validaram as fotos do entulho com cuidado. A rua ganhou pressao para limpeza.', 'Em 3 minutos registrei a arvore caida na minha quadra. No mesmo dia virou alerta publico.'].map((quote, index) => (
            <blockquote className="rounded-xl border border-[#e3e8ec] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.07)]" key={quote}>
              <p className="text-[12px] leading-snug text-[#48525f]">“{quote}”</p>
              <footer className="mt-5 text-[12px] font-semibold text-[#15191e]">{['Felipe M.', 'Kayque G.', 'Arthur A.'][index]}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1296px] grid-cols-[330px_1fr] gap-10 px-6 py-14 max-lg:grid-cols-1" aria-labelledby="neighborhood-title">
        <SectionCopy pill="Concentracao por bairro" title="Onde os problemas estao se acumulando" id="neighborhood-title" action="Ver ranking completo" href="/ranking" />
        <ol className="grid gap-[18px]">
          {neighborhoodRanking.map(([name, count, risk, color], index) => (
            <li className="grid grid-cols-[38px_150px_1fr_78px_60px] items-center gap-3 text-[13px] font-semibold max-md:grid-cols-1" key={name}>
              <span className="font-bold text-[#d1d8de]">{String(index + 1).padStart(2, '0')}</span>
              <strong>{name}</strong>
              <span className="h-[18px] rounded bg-[#eff3f5]"><span className="block h-[18px] rounded" style={{ width: `${(count / maxNeighborhood) * 100}%`, background: color }} /></span>
              <span className="text-[11px]" style={{ color }}>{count} relatos</span>
              <span className="rounded-[10px] px-2 py-1 text-[10px] font-bold" style={{ background: `${color}1f`, color }}>{risk}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-[#e3e8ec] bg-white">
        <div className="mx-auto max-w-[1296px] px-6 py-14">
          <SectionCopy pill="Moderacao e qualidade" title="Cada relato e verificado antes de ir ao mapa" id="validation-title" />
          <ol className="mt-8 grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1">
            {['Envio pelo Cidadao', 'Analise da Equipe', 'Publicacao no Mapa', 'Acompanhamento'].map((step, index) => (
              <li className="rounded-xl border border-[#e3e8ec] border-t-[3px] bg-[#f8fafb] p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]" style={{ borderTopColor: ['#2469d6', '#f4b60d', '#1a9651', '#63a93a'][index] }} key={step}>
                <span className="grid size-8 place-items-center rounded-lg bg-[#e0f5e9] text-[11px] font-bold text-[#1a9651]">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-[13px] font-bold">{step}</h3>
                <p className="mt-2 text-[11px] leading-snug text-[#48525f]">Etapa de validacao com acompanhamento publico e historico da plataforma.</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <section className="mx-auto my-4 flex w-[calc(100%-96px)] max-w-[1296px] flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f4b60d]/40 bg-[#fff6d6] px-5 py-3 text-[12px] font-semibold text-[#725600] max-md:w-[calc(100%-32px)]" aria-live="polite">
      <span>{message}</span>
      <button className="rounded-md bg-[#15191e] px-3 py-2 text-white" onClick={onRetry} type="button">Tentar novamente</button>
    </section>
  );
}

function SkeletonCard() {
  return <article className="min-h-[220px] animate-pulse rounded-xl border border-[#e3e8ec] bg-[#e3e8ec]" aria-label="Carregando relato" />;
}

function SectionCopy({ pill, title, id, action, href = '#' }) {
  return (
    <article>
      <p className="inline-flex h-[26px] items-center rounded-[13px] bg-[#e0f5e9] px-3 text-[10px] font-bold uppercase text-[#1a9651]">{pill}</p>
      <h2 id={id} className="mt-3 text-[28px] font-bold leading-tight">{title}</h2>
      <p className="mt-3 text-[14px] leading-snug text-[#8b96a3]">Acompanhe volume, status e concentracao dos relatos por bairro.</p>
      {action ? <a className="mt-7 inline-grid h-10 min-w-[170px] place-items-center rounded-lg border border-[#1a9651] px-4 text-[12px] font-bold text-[#1a9651]" href={href}>{action}</a> : null}
    </article>
  );
}

function FeaturedCard({ report }) {
  return (
    <article className="rounded-xl border border-[#e3e8ec] border-t-4 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.07)]" style={{ borderTopColor: report.color }}>
      <header className="flex justify-between gap-3">
        <span className="rounded-xl px-[10px] py-1 text-[10px] font-bold" style={{ background: `${report.color}1f`, color: report.color }}>{report.category}</span>
        <span className="rounded-xl bg-[#eff3f5] px-2 py-1 text-[11px] text-[#48525f]">▲ {report.votes}</span>
      </header>
      <h3 className="mt-4 text-[18px] font-bold">{report.title}</h3>
      <p className="mt-2 text-[13px] leading-snug text-[#48525f]">{report.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">{[report.neighborhood, report.status, report.time].map((tag) => <span className="rounded-xl bg-[#eff3f5] px-2 py-1 text-[10px] font-semibold text-[#48525f]" key={tag}>{tag}</span>)}</div>
      <a className="mt-4 grid h-8 place-items-center rounded-md border border-[#1a9651] text-[11px] font-bold text-[#1a9651]" href="#">Ver relato completo →</a>
    </article>
  );
}

function HorizontalBar({ name, percent, color }) {
  return (
    <div className="grid grid-cols-[150px_1fr_44px] items-center gap-4 text-[12px] text-[#48525f] max-md:grid-cols-1">
      <span>{name}</span>
      <span className="h-[18px] rounded bg-[#eff3f5]"><span className="block h-[18px] rounded" style={{ width: `${percent}%`, background: color }} /></span>
      <strong style={{ color }}>{percent}%</strong>
    </div>
  );
}
