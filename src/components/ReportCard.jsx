const toneMap = {
  blue: '#2469d6',
  red: '#d62727',
  orange: '#f35c22',
  green: '#63a93a',
  brown: '#8b6328',
  teal: '#16a3a3',
};

const statusClasses = {
  Aberto: 'bg-[#e0efff] text-[#1a61d6]',
  'Em andamento': 'bg-[#fff6d6] text-[#b08000]',
  Resolvido: 'bg-[#e0f5e9] text-[#1a9651]',
};

export default function ReportCard({ report }) {
  const color = report.color || toneMap[report.tone] || '#1a9651';

  return (
    <article className="relative flex min-h-[220px] flex-col overflow-hidden rounded-xl border border-[#e3e8ec] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex min-h-[220px] flex-col p-[15px] pt-[19px]">
        <header className="flex items-center gap-[10px]">
          <span className="inline-flex h-[22px] items-center rounded-xl px-[10px] text-[10px] font-semibold" style={{ backgroundColor: `${color}1f`, color }}>
            {report.category}
          </span>
          <span className="text-[10px] leading-3 text-[#8b96a3]">{report.neighborhood}</span>
        </header>

        <h3 className="mt-[10px] line-clamp-2 min-h-[48px] text-[20px] font-semibold leading-6 text-[#15191e]">
          {report.title}
        </h3>
        <p className="mt-[10px] line-clamp-2 min-h-[42px] text-[14px] leading-[19px] text-[#48525f]">
          {report.description}
        </p>

        <footer className="mt-auto grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 border-t border-[#eff3f5] pt-[13px]">
          <span className={`inline-flex h-6 items-center rounded-xl px-[10px] text-[10px] font-semibold ${statusClasses[report.status] || statusClasses.Aberto}`}>
            {report.status}
          </span>
          <time className="text-[11px] text-[#8b96a3]">{report.time}</time>
          <span className="justify-self-end rounded-xl bg-[#eff3f5] px-2 py-[5px] text-[11px] font-medium text-[#48525f]">
            ▲ {report.votes}
          </span>
          <a className="grid size-5 place-items-center rounded-[10px] bg-[#e0f5e9] text-[12px] font-bold text-[#1a9651]" href="#" aria-label={`Abrir relato ${report.title}`}>
            →
          </a>
        </footer>
      </div>
    </article>
  );
}
