import { useEffect, useMemo, useRef, useState } from 'react';

const progressSteps = ['Dados Pessoais', 'Verificação', 'Preferências', 'Bem-vindo!'];
const verificationEmail = 'sergio.silva@gmail.com';
const initialCountdown = 60;

function maskEmail(email) {
  const [user, domain] = email.split('@');

  if (!user || !domain) {
    return email;
  }

  const visible = user.slice(0, Math.min(2, user.length));

  return `${visible}***@${domain}`;
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function ProgressBar() {
  const activeStep = 1;

  return (
    <div className="rounded-[14px] border border-[#e3e8ec] bg-white px-4 py-5 shadow-[0_12px_38px_rgba(17,107,56,0.08)] sm:px-7">
      <div className="relative grid grid-cols-4 gap-2">
        <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-[3px] rounded-full bg-[#e3e8ec]" />
        <div
          className="absolute left-[12.5%] top-[18px] h-[3px] rounded-full bg-[#1a9651]"
          style={{ width: `${(activeStep / (progressSteps.length - 1)) * 75}%` }}
        />
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

export default function VerifyEmailPage() {
  const [code, setCode] = useState(() => Array(6).fill(''));
  const [remainingSeconds, setRemainingSeconds] = useState(initialCountdown);
  const inputRefs = useRef([]);
  const maskedEmail = useMemo(() => maskEmail(verificationEmail), []);
  const codeComplete = code.every(Boolean);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function focusInput(index) {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  }

  function updateCodeFromDigits(startIndex, digits) {
    const nextCode = [...code];
    const availableDigits = digits.slice(0, nextCode.length - startIndex);

    availableDigits.forEach((digit, offset) => {
      nextCode[startIndex + offset] = digit;
    });

    setCode(nextCode);

    const nextFocusIndex = Math.min(startIndex + availableDigits.length, nextCode.length - 1);
    window.requestAnimationFrame(() => focusInput(nextFocusIndex));
  }

  function handleChange(index, event) {
    const digits = event.target.value.replace(/\D/g, '');

    if (!digits) {
      const nextCode = [...code];
      nextCode[index] = '';
      setCode(nextCode);
      return;
    }

    updateCodeFromDigits(index, digits);
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      event.preventDefault();
      const nextCode = [...code];
      nextCode[index - 1] = '';
      setCode(nextCode);
      window.requestAnimationFrame(() => focusInput(index - 1));
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    }

    if (event.key === 'ArrowRight' && index < code.length - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  function handlePaste(index, event) {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '');

    if (!pastedDigits) {
      return;
    }

    event.preventDefault();
    updateCodeFromDigits(index, pastedDigits);
  }

  function handleResend(event) {
    event.preventDefault();
    setCode(Array(6).fill(''));
    setRemainingSeconds(initialCountdown);
    window.requestAnimationFrame(() => focusInput(0));
  }

  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <div className="min-h-[calc(100vh-68px)] bg-[#f8fafb] px-5 py-8 text-[#15191e] sm:px-8 lg:px-[72px]">
      <section className="mx-auto max-w-[920px]">
        <ProgressBar />

        <main className="mx-auto mt-8 max-w-[520px] rounded-[14px] border border-[#e3e8ec] bg-white p-6 text-center shadow-[0_18px_48px_rgba(21,25,30,0.10)] sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-[#e0f5e9] text-[#1a9651]" aria-hidden="true">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24">
              <path d="M4.75 6.75h14.5v10.5H4.75V6.75Z" fill="currentColor" opacity="0.16" />
              <path
                d="M5.75 6.75h12.5c.83 0 1.5.67 1.5 1.5v7.5c0 .83-.67 1.5-1.5 1.5H5.75c-.83 0-1.5-.67-1.5-1.5v-7.5c0-.83.67-1.5 1.5-1.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="m5.25 8 5.88 4.44c.52.39 1.22.39 1.74 0L18.75 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </span>

          <h1 className="mt-5 text-[28px] font-extrabold leading-[34px] text-[#15191e]">Verifique seu e-mail</h1>
          <p className="mx-auto mt-2 max-w-[390px] text-[13px] leading-[19px] text-[#66717f]">
            Enviamos um código de 6 dígitos para <strong className="font-bold text-[#15191e]">{maskedEmail}</strong>. Digite o código abaixo para continuar seu cadastro.
          </p>

          <form className="mt-7" onSubmit={handleSubmit}>
            <fieldset>
              <legend className="sr-only">Código de verificação</legend>
              <div className="flex justify-center gap-2 sm:gap-3">
                {code.map((digit, index) => (
                  <input
                    aria-label={`Dígito ${index + 1}`}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    className="h-12 w-11 rounded-lg border border-[#dbe3e8] bg-white text-center text-[20px] font-extrabold leading-none text-[#15191e] outline-none transition focus:border-[#1a9651] focus:ring-4 focus:ring-[#1a9651]/10 sm:h-14 sm:w-12"
                    inputMode="numeric"
                    key={index}
                    maxLength={1}
                    onChange={(event) => handleChange(index, event)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    onPaste={(event) => handlePaste(index, event)}
                    pattern="[0-9]*"
                    ref={(element) => {
                      inputRefs.current[index] = element;
                    }}
                    type="text"
                    value={digit}
                  />
                ))}
              </div>
            </fieldset>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#e0f5e9] px-4 py-2 text-[12px] font-bold leading-none text-[#116b38]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 7v5l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" />
              </svg>
              {remainingSeconds > 0 ? `Código expira em ${formatCountdown(remainingSeconds)}` : 'Código expirado'}
            </div>

            <button
              className="mt-6 h-12 w-full rounded-lg bg-[#1a9651] text-[14px] font-bold text-white shadow-[0_10px_20px_rgba(26,150,81,0.24)] transition hover:bg-[#116b38] disabled:cursor-not-allowed disabled:bg-[#91cdaa] disabled:shadow-none"
              disabled={!codeComplete}
              type="submit"
            >
              Confirmar
            </button>
          </form>

          <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] font-semibold">
            <a className="text-[#66717f] transition hover:text-[#15191e]" href="#nao-recebi">
              Não recebi o código
            </a>
            <span className="text-[#d8e0e6]" aria-hidden="true">
              |
            </span>
            <a className="font-bold text-[#1a9651] transition hover:text-[#116b38]" href="#reenviar" onClick={handleResend}>
              Reenviar
            </a>
          </footer>
        </main>
      </section>
    </div>
  );
}