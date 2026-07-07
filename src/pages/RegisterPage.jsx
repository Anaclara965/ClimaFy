import { useMemo, useState } from 'react';

const progressSteps = ['Dados Pessoais', 'Verificação', 'Preferências', 'Bem-vindo!'];

const strengthLabels = ['Fraca', 'Média', 'Forte'];

function getPasswordStrength(password) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(score, 3);
}

export default function RegisterPage() {
  const [password, setPassword] = useState('');
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  return (
    <div className="min-h-[calc(100vh-68px)] bg-[#f8fafb] px-5 py-8 text-[#15191e] sm:px-8 lg:px-[72px]">
      <section className="mx-auto max-w-[920px]">
        <div className="rounded-[14px] border border-[#e3e8ec] bg-white px-4 py-5 shadow-[0_12px_38px_rgba(17,107,56,0.08)] sm:px-7">
          <div className="relative grid grid-cols-4 gap-2">
            <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-[3px] rounded-full bg-[#e3e8ec]" />
            <div className="absolute left-[12.5%] top-[18px] h-[3px] w-[25%] rounded-full bg-[#1a9651]" />
            {progressSteps.map((step, index) => {
              const active = index === 0;
              const completed = index < 1;

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

        <main className="mx-auto mt-8 max-w-[720px] rounded-[14px] border border-[#e3e8ec] bg-white p-5 shadow-[0_18px_48px_rgba(21,25,30,0.10)] sm:p-8">
          <header className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[#e0f5e9] text-[#1a9651]" aria-hidden="true">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24">
                <path d="M19.5 4.5c-6.3.2-10.6 2.7-12.7 7.4-1.4 3.2-.7 5.8 1.2 7.1 2 1.3 4.7.7 6.7-1.5 2.3-2.5 3.2-6.7 4.8-13Z" fill="currentColor" opacity="0.92" />
                <path d="M5.2 20.2c2.6-5 6.1-8.5 10.4-10.7" stroke="#116b38" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
            </span>
            <h1 className="mt-5 text-[28px] font-extrabold leading-[34px] text-[#15191e]">Criar sua conta</h1>
            <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-[18px] text-[#66717f]">
              Registre relatos, acompanhe alertas e ajude sua comunidade a mapear riscos climáticos.
            </p>
          </header>

          <button
            className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#dbe3e8] bg-white text-[14px] font-semibold text-[#15191e] transition hover:bg-[#f8fafb]"
            type="button"
          >
            <img alt="" className="h-5 w-5" src="https://www.svgrepo.com/show/475656/google-color.svg" />
            Continuar com Google
          </button>

          <div className="my-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-[#e3e8ec]" />
            <span className="text-[12px] font-medium text-[#8b96a3]">ou</span>
            <span className="h-px flex-1 bg-[#e3e8ec]" />
          </div>

          <form className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[#15191e]">Nome</span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                  placeholder="Sergio"
                  type="text"
                />
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold text-[#15191e]">Sobrenome</span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                  placeholder="Silva"
                  type="text"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[13px] font-semibold text-[#15191e]">E-mail</span>
              <input
                className="mt-2 h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                placeholder="sergio.silva@gmail.com"
                type="email"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[#15191e]">Senha</span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  type="password"
                  value={password}
                />
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold text-[#15191e]">Confirmar senha</span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                  placeholder="Repita sua senha"
                  type="password"
                />
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#48525f]">Força da senha</span>
                <span className="text-[12px] font-semibold text-[#1a9651]">{passwordStrength ? strengthLabels[passwordStrength - 1] : 'Digite uma senha'}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((bar) => {
                  const active = passwordStrength >= bar;
                  const colors = ['bg-[#d62727]', 'bg-[#f8c537]', 'bg-[#1a9651]'];

                  return <span className={`h-2 rounded-full ${active ? colors[bar - 1] : 'bg-[#e3e8ec]'}`} key={bar} />;
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[#15191e]">Cidade</span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                  placeholder="São Paulo"
                  type="text"
                />
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold text-[#15191e]">Bairro</span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-[#dbe3e8] bg-white px-4 text-[14px] text-[#15191e] outline-none transition placeholder:text-[#a1abb6] focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10"
                  placeholder="Jardim Helena"
                  type="text"
                />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-[#e3e8ec] bg-[#f8fafb] p-4">
              <input className="mt-1 h-4 w-4 accent-[#1a9651]" type="checkbox" />
              <span className="text-[12px] leading-[17px] text-[#48525f]">
                Aceito os <a className="font-semibold text-[#1a9651]" href="#termos">termos de uso</a> e autorizo o uso dos meus dados para monitoramento comunitário.
              </span>
            </label>

            <div className="flex items-center gap-3 rounded-lg bg-[#e0f5e9] px-4 py-3 text-[#116b38]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white" aria-hidden="true">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <path d="M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z" fill="currentColor" opacity="0.92" />
                </svg>
              </span>
              <span className="text-[12px] font-semibold leading-[17px]">Suas informações são protegidas com criptografia e usadas apenas para melhorar alertas da sua região.</span>
            </div>

            <button className="h-12 w-full rounded-lg bg-[#1a9651] text-[14px] font-bold text-white shadow-[0_10px_20px_rgba(26,150,81,0.24)] transition hover:bg-[#116b38]" type="submit">
              Criar conta gratuita
            </button>
          </form>

          <footer className="mt-7 text-center text-[13px] text-[#66717f]">
            Já tenho conta{' '}
            <a className="font-bold text-[#1a9651] hover:text-[#116b38]" href="#entrar">
              Entrar agora
            </a>
          </footer>
        </main>
      </section>
    </div>
  );
}