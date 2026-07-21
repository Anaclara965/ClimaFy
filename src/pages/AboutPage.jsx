const purposeCards = [
  ['Nossa Missao', 'Nossa missao e preencher a lacuna dos dados climaticos oficiais, transformando cidadaos comuns em coletores ativos de informacoes ambientais no nivel de suas ruas e bairros.', 'MISSÃO', 'mission'],
  ['Monitoramento Hiperlocal', 'Registrar e visualizar eventos climaticos e impactos ambientais no nivel do bairro e da rua.', 'OBJETIVO', 'goal'],
  ['Engajamento Comunitario', 'Transformar moradores em agentes ativos de mudanca, criando uma rede colaborativa de monitoramento.', 'OBJETIVO', 'goal'],
  ['Transparencia Publica', 'Cruzar relatos da populacao com portais de transparencia para gerar rankings publicos.', 'OBJETIVO', 'goal'],
  ['Colaboracao', 'A uniao de relatos individuais constroi uma rede de protecao coletiva.', 'VALORES', 'value'],
  ['Confiabilidade e Rigor', 'Todos os dados passam por moderacao para garantir qualidade das informacoes.', 'VALORES', 'value'],
  ['Justica Social', 'Direcionar atencao e investimento para comunidades onde o risco climatico e critico.', 'VALORES', 'value'],
];

const steps = [
  ['01', 'Voce ve o problema', 'Alagamento, bueiro, queimada, arvore caida ou qualquer evento ambiental.', '#1a9651'],
  ['02', 'Registra no mapa', 'Clique no local exato, escolha a categoria, descreva e envie uma foto.', '#3894d6'],
  ['03', 'Dados sao cruzados', 'Seu relato e cruzado com dados de investimento publico e vulnerabilidade.', '#f29c12'],
  ['04', 'Pressao por mudanca', 'O ranking publico evidencia onde falta investimento e acao do poder publico.', '#d63b3b'],
];

const tech = [
  ['React 18 + Vite', 'Frontend'],
  ['Leaflet.js', 'Mapas'],
  ['Node.js + Express', 'Backend'],
  ['MySQL 8', 'Banco de Dados'],
  ['JWT Auth', 'Seguranca'],
];

const team = [
  ['Lu', 'Larissa Uchôa', 'Frontend + Mapa', 'Frontend'],
  ['S', 'Sophia Ribeiro', 'Frontend + Mapa', 'Frontend'],
  ['G', 'Guilherme Brito', 'Backend + Banco', 'Backend'],
  ['A', 'Ana Clara', 'Backend + Banco', 'Backend'],
  ['B', 'Beatriz Siqueira', 'Negocios + Docs', 'Negocios'],
  ['Lu', 'Lucas Moraes', 'Negocios + Docs', 'Negocios'],
];

export default function AboutPage() {
  return (
    <div className="bg-[#f8fafb] text-[#1a2635]">
      <section className="relative min-h-[200px] overflow-hidden bg-[#116b38] px-[72px] py-14 text-white max-md:px-6" aria-labelledby="about-title">
        <div className="absolute -left-20 -top-20 size-80 rounded-full bg-[#63a93a]/20" />
        <div className="absolute -right-20 -top-16 size-[280px] rounded-full bg-[#63a93a]/20" />
        <h1 id="about-title" className="relative text-[64px] font-bold leading-none max-md:text-[42px]">Sobre o ClimaFy</h1>
        <p className="relative mt-3 max-w-[700px] text-[16px] text-[#c7ead1]">Uma plataforma colaborativa que transforma cidadaos em guardioes do clima urbano.</p>
      </section>

      <section className="grid min-h-[340px] grid-cols-[580px_1fr] items-center gap-40 border-t border-[#e3e8ec] bg-white px-[72px] py-11 max-xl:grid-cols-1 max-md:px-6" aria-labelledby="what-title">
        <SectionCopy pill="O que e" title="Uma rede de monitoramento comunitario hiperlocal" id="what-title">
          O ClimaFy permite que qualquer cidadao registre eventos climaticos e impactos ambientais diretamente em um mapa interativo georreferenciado. Os dados oficiais operam em escala regional; nos capturamos o que acontece na sua rua.
        </SectionCopy>
        <dl className="grid grid-cols-4 max-md:grid-cols-2">
          {[
            ['1.247', 'Relatos Ativos'],
            ['48', 'Bairros'],
            ['12', 'Cidades'],
            ['312', 'Resolvidos'],
          ].map(([value, label]) => <div className="border-l border-[#e3e8ec] pl-9 first:border-l-0 first:pl-0 max-md:border-l-0 max-md:py-3" key={label}><dd className="text-[30px] font-bold text-[#1a9651]">{value}</dd><dt className="text-[12px] text-[#87919b]">{label}</dt></div>)}
        </dl>
      </section>

      <section className="grid min-h-[370px] grid-cols-[530px_1fr] items-center gap-14 bg-white px-[72px] py-9 max-xl:grid-cols-1 max-md:px-6" aria-labelledby="problem-title">
        <article>
          <Pill>Problema que resolve</Pill>
          <h2 id="problem-title" className="mt-3 text-[30px] font-bold leading-tight">Dados climaticos existem. Mas nao chegam onde precisam.</h2>
          <ul className="mt-6 grid gap-4 text-[13px] leading-snug text-[#48525f]">
            <li>Orgaos como CEMADEN operam em escala municipal e nao capturam o nivel da rua ou bairro.</li>
            <li>Eventos climaticos extremos atingem regioes vulneraveis antes da resposta publica chegar.</li>
            <li>Prefeituras e Defesa Civil precisam de dados hiperlocais para decisoes ageis.</li>
          </ul>
        </article>
        <article className="grid min-h-[286px] grid-cols-[300px_1fr] gap-8 overflow-hidden rounded-2xl border border-[#e3e8ec] bg-[#f8fafb] p-[15px] pl-5 max-md:grid-cols-1">
          <div>
            <span className="mt-5 block text-[48px]">🌿</span>
            <h3 className="mt-5 text-[24px] font-bold leading-tight"><strong className="text-[#1a9651]">ClimaFy</strong> preenche essa lacuna</h3>
            <p className="mt-4 text-[13px] leading-snug text-[#48525f]">Cidadaos comuns se tornam coletores de dados ambientais, criando uma rede de monitoramento de baixo custo e alta granularidade.</p>
          </div>
          <img className="h-[254px] w-full rounded-[17px] object-cover" src="https://www.figma.com/api/mcp/asset/5d0a25bd-fccd-4163-9dcc-f16cdb22aff8" alt="Ponte estaiada e skyline urbano ao entardecer" />
        </article>
      </section>

      <section className="border-t border-[#e3e8ec] bg-[#f8fafb] px-[72px] py-11 max-md:px-6" aria-labelledby="purpose-title">
        <Pill>Missao, objetivos e valores</Pill>
        <h2 id="purpose-title" className="mt-3 text-[30px] font-bold">Proposito e compromisso</h2>
        <div className="mt-7 grid grid-cols-[277px_repeat(3,minmax(0,1fr))] gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          {purposeCards.map(([title, text, tag, type], index) => <PurposeCard key={title} title={title} text={text} tag={tag} type={type} index={index} />)}
        </div>
      </section>

      <section className="border-t border-[#e3e8ec] bg-white px-[72px] py-11 max-md:px-6" aria-labelledby="steps-title">
        <Pill>Como funciona</Pill>
        <h2 id="steps-title" className="mt-3 max-w-[700px] text-[30px] font-bold leading-tight">Do relato ao investimento publico em 4 passos</h2>
        <ol className="mt-7 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
          {steps.map(([number, title, text, color]) => <li className="min-h-[176px] rounded-xl border border-t-4 border-[#e3e8ec] bg-white p-5" style={{ borderTopColor: color }} key={number}><span className="grid size-9 place-items-center rounded-lg bg-[#eaf7ee] text-[15px] font-bold text-[#1a9651]">{number}</span><h3 className="mt-3 text-[14px] font-bold">{title}</h3><p className="mt-2 text-[13px] leading-snug text-[#87919b]">{text}</p></li>)}
        </ol>
      </section>

      <section className="bg-[#eaf7ee] px-[72px] py-11 max-md:px-6" aria-labelledby="tech-title">
        <Pill>Stack tecnologica</Pill>
        <h2 id="tech-title" className="mt-3 max-w-[520px] text-[30px] font-bold leading-tight">Construido com tecnologias modernas e acessiveis</h2>
        <ul className="mt-6 grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">{tech.map(([name, label]) => <li className="min-h-[60px] rounded-[10px] border border-[#e3e8ec] bg-white p-4" key={name}><strong className="text-[13px]">{name}</strong><span className="mt-2 block text-[11px] text-[#1a9651]">{label}</span></li>)}</ul>
      </section>

      <section className="border-t border-[#e3e8ec] bg-white px-[72px] py-11 max-md:px-6" aria-labelledby="team-title">
        <Pill>A equipe</Pill>
        <h2 id="team-title" className="mt-3 max-w-[520px] text-[30px] font-bold leading-tight">6 pessoas, 1 missao: tornar o clima urbano visivel</h2>
        <div className="mt-7 grid grid-cols-6 gap-5 max-xl:grid-cols-3 max-md:grid-cols-1">
          {team.map(([initials, name, role, front]) => <article className="min-h-40 rounded-xl border border-[#e3e8ec] bg-white p-5 text-center" key={name}><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#eaf7ee] text-[18px] font-bold text-[#1a9651]">{initials}</span><h3 className="mt-3 text-[13px] font-semibold text-[#48525f]">{name}</h3><p className="mt-1 text-[12px] text-[#87919b]">{role}</p><span className="mt-3 inline-flex h-[22px] items-center rounded-full bg-[#e1f6e8] px-4 text-[10px] font-bold text-[#116b38]">{front}</span></article>)}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#116b38] px-6 py-9 text-center text-white" aria-labelledby="cta-title">
        <h2 id="cta-title" className="text-[32px] font-bold">Viu algo errado na sua cidade?</h2>
        <p className="mt-3 text-[14px] text-[#c7ead1]">Seu relato pode mudar a realidade do seu bairro. Registre agora — e gratuito e leva 2 minutos.</p>
        <menu className="mt-7 flex justify-center gap-5 max-sm:flex-wrap"><li><a className="grid h-12 w-56 place-items-center rounded-xl border-2 border-[#63a83b] bg-[#1a9651] text-[14px] font-bold" href="/novo-relato">+ Registrar um Evento</a></li><li><a className="grid h-12 w-56 place-items-center rounded-xl bg-white text-[14px] font-bold text-[#116b38]" href="/#mapa">Ver o Mapa Interativo →</a></li></menu>
      </section>
    </div>
  );
}

function Pill({ children }) {
  return <p className="inline-flex h-[26px] items-center rounded-full bg-[#e1f6e8] px-3 text-[12px] font-bold uppercase text-[#116b38]">{children}</p>;
}

function SectionCopy({ pill, title, id, children }) {
  return <article><Pill>{pill}</Pill><h2 id={id} className="mt-3 text-[32px] font-bold leading-tight">{title}</h2><p className="mt-5 text-[14px] leading-relaxed text-[#48525f]">{children}</p></article>;
}

function PurposeCard({ title, text, tag, type, index }) {
  const isMission = type === 'mission';
  const isValue = type === 'value';
  return (
    <article className={`rounded-2xl border border-[#e3e8ec] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${isMission ? 'min-h-[382px] xl:row-span-2' : 'min-h-[185px]'}`}>
      {!isMission ? <><span className="inline-grid size-9 place-items-center rounded-[10px] bg-[#15191e] text-[13px] font-bold text-white">#{Math.min(index, 3)}</span><span className={`ml-3 inline-flex h-[26px] items-center rounded-full px-3 text-[12px] font-bold ${isValue ? 'bg-[#e1f6e8] text-[#116b38]' : 'bg-[#fff6d6] text-[#f4b60d]'}`}>{tag}</span></> : null}
      <h3 className="mt-3 text-[20px] font-bold leading-tight">{title}</h3>
      <p className="mt-3 text-[13px] leading-snug text-[#48525f]">{text}</p>
    </article>
  );
}
