import { Link } from 'react-router-dom';

const progressSteps = ['Dados Pessoais', 'Verificacao', 'Preferencias', 'Bem-vindo!'];

const summary = [
  ['Nome', 'Sergio Silva'],
  ['E-mail', 'sergio.silva@gmail.com'],
  ['Bairro', 'Jardim Helena'],
];

const nextSteps = [
  'Explore o mapa e veja relatos climaticos perto de voce.',
  'Vote em relatos importantes para aumentar a prioridade do bairro.',
  'Registre um novo evento sempre que perceber risco na sua regiao.',
];

function ProgressBar() {
  return (
    <div className="rounded-[14px] border border-[#e3e8ec] bg-white px-4 py-5 shadow-[0_12px_38px_rgba(17,107,56,0.08)] sm:px-7">
      <div className="relative grid grid-cols-4 gap-2">
        <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-[3px] rounded-full bg-[#1a9651]" />
        {progressSteps.map((step, index) => (
          <div className="relative z-10 flex flex-col items-center text-center" key={step}>
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#1a9651] bg-[#1a9651] text-[12px] font-bold leading-none text-white shadow-[0_6px_16px_rgba(26,150,81,0.24)]">
              {index + 1}
            </span>
            <span className="mt-3 text-[11px] font-bold leading-[14px] text-[#15191e] sm:text-[12px]">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="absolute left-[72px] top-[34px] h-3.5 w-3.5 animate-[confetti-float_2.8s_ease-in-out_infinite] rounded-full bg-[#1a9651]" />
      <span className="absolute left-[136px] top-[82px] h-[18px] w-[9px] rotate-[24deg] animate-[confetti-float_2.8s_160ms_ease-in-out_infinite] rounded-full bg-[#2469d6]" />
      <span className="absolute right-[92px] top-[42px] h-2.5 w-4 -rotate-[18deg] animate-[confetti-float_2.8s_320ms_ease-in-out_infinite] rounded-full bg-[#f0c21d]" />
      <span className="absolute right-[54px] top-[118px] h-3 w-3 animate-[confetti-float_2.8s_480ms_ease-in-out_infinite] rounded-full bg-[#f37d22]" />
      <span className="absolute left-14 top-[184px] h-5 w-2.5 -rotate-[32deg] animate-[confetti-float_2.8s_640ms_ease-in-out_infinite] rounded-full bg-[#d62727]" />
      <span className="absolute right-[84px] top-[210px] h-[13px] w-[13px] animate-[confetti-float_2.8s_800ms_ease-in-out_infinite] rounded-full bg-[#63a93a]" />
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div className="min-h-[calc(100vh-68px)] bg-[#f8fafb] px-5 py-8 text-[#15191e] sm:px-8 lg:px-[72px]">
      <style>
        {`
          @keyframes confetti-float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-8px) rotate(14deg); }
          }
          @keyframes success-pop {
            0% { transform: scale(0.72); opacity: 0; }
            70% { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>

      <section className="mx-auto max-w-[920px]">
        <ProgressBar />

        <main className="relative mx-auto mt-8 max-w-[640px] overflow-hidden rounded-[14px] border border-[#e3e8ec] bg-white p-6 shadow-[0_18px_48px_rgba(21,25,30,0.10)] sm:p-8">
          <Confetti />

          <header className="relative z-10 text-center">
            <span className="mx-auto grid h-[78px] w-[78px] animate-[success-pop_780ms_cubic-bezier(.2,1.4,.4,1)_both] place-items-center rounded-full bg-[#1a9651] text-[38px] font-black leading-none text-white shadow-[0_12px_28px_rgba(26,150,81,0.30)]" aria-hidden="true">
              ✓
            </span>
            <h1 className="mt-5 text-[32px] font-black leading-[38px] text-[#15191e]">Bem-vindo ao ClimaFy!</h1>
            <p className="mx-auto mt-3 max-w-[500px] text-[14px] leading-[22px] text-[#66717f]">
              Sua conta foi criada com sucesso. Agora voce ja pode acompanhar sua regiao, registrar eventos climaticos e ajudar sua comunidade a transformar relatos em acao.
            </p>
          </header>

          <section className="relative z-10 mt-6 rounded-xl border border-[#e3e8ec] bg-[#f8fafb] p-5">
            <h2 className="text-[14px] font-black text-[#15191e]">Resumo do cadastro</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              {summary.map(([label, value]) => (
                <div className="min-w-0 rounded-lg bg-white p-3" key={label}>
                  <dt className="text-[11px] font-black uppercase text-[#8b96a3]">{label}</dt>
                  <dd className="mt-1 break-words text-[13px] font-black text-[#15191e]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="relative z-10 mt-6 rounded-xl border border-[#e3e8ec] bg-[#f8fafb] p-5">
            <h2 className="text-[14px] font-black text-[#15191e]">Proximos passos</h2>
            <ol className="mt-4 grid gap-3">
              {nextSteps.map((step, index) => (
                <li className="grid grid-cols-[34px_1fr] items-center gap-3 rounded-lg bg-white p-3" key={step}>
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#e0f5e9] text-[13px] font-black text-[#116b38]">{index + 1}</span>
                  <p className="text-[13px] font-bold leading-[18px] text-[#48525f]">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          <nav className="relative z-10 mt-5 grid gap-3 sm:grid-cols-3" aria-label="Atalhos rapidos">
            <Link className="grid h-11 place-items-center rounded-lg border border-[#dbe3e8] bg-white text-[13px] font-black text-[#48525f] transition hover:border-[#1a9651] hover:bg-[#f2fbf5] hover:text-[#116b38]" to="/ranking">Ver Ranking</Link>
            <Link className="grid h-11 place-items-center rounded-lg border border-[#dbe3e8] bg-white text-[13px] font-black text-[#48525f] transition hover:border-[#1a9651] hover:bg-[#f2fbf5] hover:text-[#116b38]" to="/relatos">Ver Relatos</Link>
            <Link className="grid h-11 place-items-center rounded-lg border border-[#dbe3e8] bg-white text-[13px] font-black text-[#48525f] transition hover:border-[#1a9651] hover:bg-[#f2fbf5] hover:text-[#116b38]" to="/novo-relato">Novo Relato</Link>
          </nav>

          <Link className="relative z-10 mt-5 grid h-[50px] place-items-center rounded-lg bg-[#1a9651] text-[14px] font-black text-white shadow-[0_10px_20px_rgba(26,150,81,0.24)] transition hover:bg-[#116b38]" to="/#mapa">
            Explorar o Mapa
          </Link>

          <aside className="relative z-10 mt-5 grid items-center gap-4 rounded-xl border border-[#e3e8ec] bg-[#e0f5e9] p-4 sm:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-[14px] font-black text-[#15191e]">Compartilhe o ClimaFy</h2>
              <p className="mt-1 text-[12px] font-bold leading-[17px] text-[#116b38]">Convide vizinhos para fortalecer o monitoramento climatico colaborativo.</p>
            </div>
            <button className="h-[38px] rounded-lg bg-[#1a9651] px-4 text-[12px] font-black text-white" type="button">
              Copiar convite
            </button>
          </aside>
        </main>
      </section>
    </div>
  );
}
