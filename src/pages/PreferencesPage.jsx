import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const progressSteps = ['Dados Pessoais', 'Verificação', 'Preferências', 'Bem-vindo!'];

const categories = [
  'Alagamentos',
  'Deslizamentos',
  'Chuvas fortes',
  'Ondas de calor',
  'Queda de árvores',
  'Falta de energia',
  'Qualidade do ar',
  'Defesa civil',
];

const neighborhoods = ['Brás', 'Pinheiros', 'Vila Madalena', 'Jardim Helena', 'Itaquera', 'Mooca', 'Santo Amaro', 'Capão Redondo'];
const frequencyOptions = ['Imediato', 'Diário', 'Semanal'];

function ProgressBar() {
  const activeStep = 2;

  return (
    <div className="rounded-[14px] border border-[#e3e8ec] bg-white px-4 py-5 shadow-[0_12px_38px_rgba(17,107,56,0.08)] sm:px-7">
      <div className="relative grid grid-cols-4 gap-2">
        <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-[3px] rounded-full bg-[#e3e8ec]" />
        <div className="absolute left-[12.5%] top-[18px] h-[3px] w-1/2 rounded-full bg-[#1a9651]" />
        {progressSteps.map((step, index) => {
          const active = index === activeStep;
          const completed = index < activeStep;

          return (
            <div className="relative z-10 flex flex-col items-center text-center" key={step}>
              <span
                className={`grid h-9 w-9 place-items-center rounded-full border text-[12px] font-bold leading-none ${
                  active || completed
                    ? 'border-[#1a9651] bg-[#1a9651] text-white shadow-[0_6px_16px_rgba(26,150,81,0.24)]'
                    : 'border-[#d8e0e6] bg-white text-[#8b96a3]'
                }`}
              >
                {index + 1}
              </span>
              <span className={`mt-3 text-[11px] font-semibold leading-[14px] sm:text-[12px] ${active ? 'text-[#15191e]' : 'text-[#8b96a3]'}`}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState(['Jardim Helena']);
  const [frequency, setFrequency] = useState('Diário');

  const filteredNeighborhoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return neighborhoods.filter((neighborhood) => {
      const matchesQuery = !normalizedQuery || neighborhood.toLowerCase().includes(normalizedQuery);
      return matchesQuery && !selectedNeighborhoods.includes(neighborhood);
    });
  }, [query, selectedNeighborhoods]);

  function selectNeighborhood(neighborhood) {
    setSelectedNeighborhoods((current) => [...current, neighborhood]);
    setQuery('');
  }

  function removeNeighborhood(neighborhood) {
    setSelectedNeighborhoods((current) => current.filter((item) => item !== neighborhood));
  }

  function handleSubmit(event) {
    event.preventDefault();
    navigate('/cadastro/sucesso');
  }

  return (
    <div className="min-h-[calc(100vh-68px)] bg-[#f8fafb] px-5 py-8 text-[#15191e] sm:px-8 lg:px-[72px]">
      <section className="mx-auto max-w-[920px]">
        <ProgressBar />

        <main className="mx-auto mt-8 max-w-[720px] rounded-[14px] border border-[#e3e8ec] bg-white p-5 shadow-[0_18px_48px_rgba(21,25,30,0.10)] sm:p-8">
          <header className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[#e0f5e9] text-[#1a9651]" aria-hidden="true">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24">
                <path d="M12 4.5c4.2 0 7.5 2.8 7.5 6.3 0 4.8-5.2 8-7.5 8s-7.5-3.2-7.5-8c0-3.5 3.3-6.3 7.5-6.3Z" fill="currentColor" opacity="0.16" />
                <path d="M8.5 11.5 11 14l4.5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d="M12 4.5c4.2 0 7.5 2.8 7.5 6.3 0 4.8-5.2 8-7.5 8s-7.5-3.2-7.5-8c0-3.5 3.3-6.3 7.5-6.3Z" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            <h1 className="mt-5 text-[28px] font-extrabold leading-[34px] text-[#15191e]">Personalize seus alertas</h1>
            <p className="mx-auto mt-2 max-w-[460px] text-[13px] leading-[19px] text-[#66717f]">
              Escolha os temas e bairros que você quer acompanhar para receber avisos mais úteis no ClimaFy.
            </p>
          </header>

          <form className="mt-7 space-y-7" onSubmit={handleSubmit}>
            <fieldset>
              <legend className="text-[14px] font-extrabold text-[#15191e]">Categorias de interesse</legend>
              <p className="mt-1 text-[12px] font-medium text-[#66717f]">Selecione os tipos de ocorrência que fazem sentido para sua região.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {categories.map((category, index) => (
                  <label className="flex min-h-[64px] items-center gap-3 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] px-3 py-3 text-[12px] font-bold text-[#15191e] transition hover:border-[#1a9651] hover:bg-[#f2fbf5]" key={category}>
                    <input className="h-4 w-4 accent-[#1a9651]" defaultChecked={index < 3} type="checkbox" />
                    {category}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[14px] font-extrabold text-[#15191e]">Bairros monitorados</legend>
              <p className="mt-1 text-[12px] font-medium text-[#66717f]">Busque e adicione bairros para receber alertas direcionados.</p>
              <div className="relative mt-4">
                <input
                  className="h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Digite o nome do bairro"
                  type="search"
                  value={query}
                />
                {query && (
                  <div className="absolute left-0 right-0 top-[56px] z-20 overflow-hidden rounded-lg border border-[#dbe3e8] bg-white shadow-[0_14px_34px_rgba(21,25,30,0.12)]">
                    {filteredNeighborhoods.length ? (
                      filteredNeighborhoods.map((neighborhood) => (
                        <button className="block w-full px-4 py-3 text-left text-[13px] font-semibold text-[#48525f] transition hover:bg-[#e0f5e9] hover:text-[#116b38]" key={neighborhood} onClick={() => selectNeighborhood(neighborhood)} type="button">
                          {neighborhood}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-[13px] font-semibold text-[#8b96a3]">Nenhum bairro encontrado</p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedNeighborhoods.map((neighborhood) => (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e0f5e9] px-3 py-2 text-[12px] font-bold text-[#116b38]" key={neighborhood}>
                    {neighborhood}
                    <button className="text-[15px] leading-none text-[#116b38]" onClick={() => removeNeighborhood(neighborhood)} type="button" aria-label={`Remover ${neighborhood}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[14px] font-extrabold text-[#15191e]">Frequência de notificações</legend>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {frequencyOptions.map((option) => (
                  <label className={`flex min-h-[72px] items-center gap-3 rounded-lg border px-4 py-3 text-[13px] font-bold transition ${frequency === option ? 'border-[#1a9651] bg-[#e0f5e9] text-[#116b38]' : 'border-[#dbe3e8] bg-white text-[#48525f]'}`} key={option}>
                    <input checked={frequency === option} className="h-4 w-4 accent-[#1a9651]" name="frequency" onChange={() => setFrequency(option)} type="radio" />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <button className="h-12 rounded-lg bg-[#1a9651] px-6 text-[14px] font-bold text-white shadow-[0_10px_20px_rgba(26,150,81,0.24)] transition hover:bg-[#116b38]" type="submit">
                Salvar preferências
              </button>
              <button className="h-12 rounded-lg border border-[#dbe3e8] bg-white px-6 text-[14px] font-bold text-[#48525f] transition hover:bg-[#f8fafb] hover:text-[#15191e]" onClick={() => navigate('/cadastro/sucesso')} type="button">
                Pular por agora
              </button>
            </div>
          </form>
        </main>
      </section>
    </div>
  );
}