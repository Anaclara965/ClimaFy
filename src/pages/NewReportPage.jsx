import { useState } from 'react';
import { Link } from 'react-router-dom';

const categories = [
  ['Alagamento', 'A', '#2469d6'],
  ['Queimada', 'Q', '#d62727'],
  ['Calor Extremo', 'C', '#f37d22'],
  ['Arvore Caida', 'V', '#63a93a'],
  ['Lixo', 'L', '#8b6328'],
  ['Poluicao Agua', 'P', '#2469a3'],
];

const severities = ['Leve', 'Moderada', 'Grave', 'Critica'];
const steps = ['Categoria', 'Detalhes', 'Localizacao', 'Revisao'];

export default function NewReportPage() {
  const [category, setCategory] = useState('Alagamento');
  const [severity, setSeverity] = useState('Moderada');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState({ x: 52, y: 48, lat: '-23.5574', lng: '-46.6546' });
  const [feedback, setFeedback] = useState('');

  function handleMapClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setPin({
      x,
      y,
      lat: (-23.52 - y * 0.00078).toFixed(4),
      lng: (-46.73 + x * 0.00145).toFixed(4),
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFeedback('Relato mockado enviado para revisao. Nenhum backend foi acionado.');
  }

  return (
    <main className="min-h-[calc(100vh-68px)] bg-[#f8fafb] px-5 py-8 text-[#15191e] lg:px-[72px]">
      <section className="mx-auto max-w-[1180px]">
        <nav className="text-[12px] font-bold text-[#8b96a3]" aria-label="Breadcrumb">
          <ol className="flex flex-wrap gap-2">
            <li><Link className="text-[#48525f]" to="/">Inicio</Link></li>
            <li>/</li>
            <li><Link className="text-[#48525f]" to="/relatos">Relatos</Link></li>
            <li>/</li>
            <li aria-current="page">Novo relato</li>
          </ol>
        </nav>

        <header className="mt-4">
          <p className="text-[11px] font-black uppercase text-[#1a9651]">Relato colaborativo</p>
          <h1 className="mt-2 text-[32px] font-black leading-[38px] text-[#15191e]">Registrar novo evento</h1>
          <p className="mt-2 max-w-[620px] text-[14px] leading-5 text-[#66717f]">Compartilhe o que esta acontecendo na sua regiao para ajudar a comunidade a mapear riscos climaticos.</p>
        </header>

        <nav className="mt-6 rounded-[14px] border border-[#e3e8ec] bg-white px-4 py-5 shadow-[0_12px_38px_rgba(17,107,56,0.08)] sm:px-6" aria-label="Etapas do relato">
          <ol className="relative grid grid-cols-4 gap-2">
            <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-[3px] rounded-full bg-[#e3e8ec]" />
            {steps.map((step, index) => (
              <li className="relative z-10 flex flex-col items-center text-center" key={step}>
                <span className={`grid h-9 w-9 place-items-center rounded-full border text-[12px] font-black ${index === 0 ? 'border-[#1a9651] bg-[#1a9651] text-white shadow-[0_6px_16px_rgba(26,150,81,0.24)]' : 'border-[#dbe3e8] bg-white text-[#8b96a3]'}`}>
                  {index + 1}
                </span>
                <strong className={`mt-3 text-[12px] font-black ${index === 0 ? 'text-[#15191e]' : 'text-[#8b96a3]'}`}>{step}</strong>
              </li>
            ))}
          </ol>
        </nav>

        <form className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]" onSubmit={handleSubmit}>
          <section className="rounded-[14px] border border-[#e3e8ec] bg-white p-6 shadow-[0_18px_48px_rgba(21,25,30,0.10)]">
            <header>
              <h2 className="text-[18px] font-black text-[#15191e]">Detalhes do evento</h2>
              <p className="mt-1 text-[13px] leading-[18px] text-[#66717f]">Escolha a categoria e descreva a situacao com clareza.</p>
            </header>

            <fieldset className="mt-6">
              <legend className="text-[13px] font-black text-[#15191e]">Categoria</legend>
              <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                {categories.map(([label, icon, color]) => (
                  <li key={label}>
                    <button
                      className={`grid min-h-[104px] w-full place-items-center gap-2 rounded-[10px] border p-3 text-center transition ${category === label ? 'border-[#1a9651] bg-[#f2fbf5] text-[#15191e]' : 'border-[#dbe3e8] bg-[#f8fafb] text-[#48525f]'}`}
                      onClick={() => setCategory(label)}
                      type="button"
                    >
                      <span className="grid h-[42px] w-[42px] place-items-center rounded-xl text-[14px] font-black text-white" style={{ backgroundColor: color }}>{icon}</span>
                      <strong className="text-[12px] font-black leading-tight">{label}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>

            <fieldset className="mt-6 grid gap-2">
              <label className="text-[13px] font-black" htmlFor="report-title">Titulo do relato</label>
              <input className="h-[46px] rounded-lg border border-[#dbe3e8] px-3.5 text-[14px] outline-none focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10" id="report-title" maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Rua alagada apos chuva forte" value={title} />
              <small className="justify-self-end text-[11px] font-bold text-[#8b96a3]">{title.length}/80 caracteres</small>
            </fieldset>

            <fieldset className="mt-6 grid gap-2">
              <label className="text-[13px] font-black" htmlFor="report-description">Descricao</label>
              <textarea className="min-h-28 rounded-lg border border-[#dbe3e8] px-3.5 py-3 text-[14px] leading-5 outline-none focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10" id="report-description" maxLength={280} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva o que aconteceu, quando comecou e se ha riscos para moradores." value={description} />
              <small className="justify-self-end text-[11px] font-bold text-[#8b96a3]">{description.length}/280 caracteres</small>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-[13px] font-black text-[#15191e]">Severidade</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {severities.map((item) => (
                  <button className={`h-[42px] rounded-lg border text-[12px] font-black ${severity === item ? 'border-[#1a9651] bg-[#e0f5e9] text-[#116b38]' : 'border-[#dbe3e8] bg-white text-[#48525f]'}`} key={item} onClick={() => setSeverity(item)} type="button">
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-[13px] font-black text-[#15191e]">Foto do local</legend>
              <label className="mt-3 grid min-h-[132px] cursor-pointer place-items-center gap-1 rounded-xl border border-dashed border-[#dbe3e8] bg-[#f8fafb] text-center text-[#48525f] transition hover:border-[#1a9651] hover:bg-[#f2fbf5]">
                <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#e0f5e9] text-[22px] font-black text-[#116b38]">+</span>
                <strong className="text-[13px] font-black">Arraste uma foto ou clique para enviar</strong>
                <small className="text-[12px] font-bold text-[#8b96a3]">PNG ou JPG ate 5MB</small>
                <input className="sr-only" type="file" accept="image/png,image/jpeg" />
              </label>
            </fieldset>
          </section>

          <aside className="rounded-[14px] border border-[#e3e8ec] bg-white p-6 shadow-[0_18px_48px_rgba(21,25,30,0.10)]">
            <header>
              <h2 className="text-[18px] font-black text-[#15191e]">Localizacao</h2>
              <p className="mt-1 text-[13px] leading-[18px] text-[#66717f]">Clique no mini-mapa para ajustar o ponto do relato.</p>
            </header>

            <section className="mt-6">
              <h3 className="text-[13px] font-black text-[#15191e]">Mini-mapa</h3>
              <button className="relative mt-3 h-[238px] w-full overflow-hidden rounded-xl border border-[#dbe3e8] bg-[#d4dfd6]" onClick={handleMapClick} type="button" aria-label="Selecionar ponto no mapa">
                <span className="absolute inset-0 bg-[linear-gradient(#f4f4f2_2px,transparent_2px),linear-gradient(90deg,#f4f4f2_2px,transparent_2px)] bg-[length:54px_54px]" />
                <span className="absolute right-[58px] top-8 h-[170px] w-16 rotate-[11deg] rounded-[26px] bg-[#abd3e7]" />
                <span className="absolute left-6 top-[34px] h-[76px] w-[118px] rounded-[10px] border border-[#f37d22] bg-[#ffede0]/70" />
                <span className="absolute bottom-[34px] left-[92px] h-[82px] w-36 rounded-[10px] border border-[#d62727] bg-[#ffe0e0]/70" />
                <span
                  className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#d62727] shadow-[0_3px_10px_rgba(21,25,30,0.28)] after:absolute after:inset-[-12px] after:animate-[pin-pulse_1.4s_ease-out_infinite] after:rounded-full after:border-2 after:border-[#d62727]/40 after:content-['']"
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                />
              </button>
              <p className="mt-3 text-[12px] font-bold text-[#66717f]">Coordenadas: <strong className="text-[#15191e]">{pin.lat}, {pin.lng}</strong></p>
            </section>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              <fieldset className="grid gap-2">
                <label className="text-[13px] font-black" htmlFor="city">Cidade</label>
                <input className="h-[46px] rounded-lg border border-[#dbe3e8] px-3.5 text-[14px] outline-none focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10" id="city" defaultValue="Sao Paulo" />
              </fieldset>
              <fieldset className="grid gap-2">
                <label className="text-[13px] font-black" htmlFor="neighborhood">Bairro</label>
                <input className="h-[46px] rounded-lg border border-[#dbe3e8] px-3.5 text-[14px] outline-none focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10" id="neighborhood" defaultValue="Bras" />
              </fieldset>
              <fieldset className="grid gap-2 sm:col-span-2">
                <label className="text-[13px] font-black" htmlFor="reference">Ponto de referencia</label>
                <input className="h-[46px] rounded-lg border border-[#dbe3e8] px-3.5 text-[14px] outline-none focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10" id="reference" placeholder="Ex: proximo a estacao, escola ou praca" />
              </fieldset>
            </div>

            <aside className="mt-6 grid grid-cols-[34px_1fr] gap-3 rounded-xl bg-[#e0f5e9] p-4 text-[#116b38]">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#d8f0df] text-[14px] font-black">i</span>
              <div>
                <strong className="text-[13px] font-black text-[#15191e]">Tempo estimado</strong>
                <p className="mt-1 text-[12px] font-bold leading-[17px]">O relato leva cerca de 2 minutos para ser enviado e fica pendente de moderacao.</p>
              </div>
            </aside>
          </aside>

          <footer className="grid gap-3 lg:col-span-2">
            <p className="min-h-[18px] text-center text-[13px] font-black text-[#116b38]">{feedback}</p>
            <button className="h-[52px] rounded-lg bg-[#1a9651] text-[14px] font-black text-white shadow-[0_10px_20px_rgba(26,150,81,0.24)] transition hover:bg-[#116b38]" type="submit">
              Enviar relato para revisao
            </button>
          </footer>
        </form>
      </section>
      <style>{`@keyframes pin-pulse{0%{transform:scale(.45);opacity:.9}100%{transform:scale(1.35);opacity:0}}`}</style>
    </main>
  );
}
