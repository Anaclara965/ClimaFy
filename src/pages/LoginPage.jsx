import { useEffect } from 'react';

export default function LoginPage() {
  useEffect(() => {
    window.location.replace('/HTML/login.html');
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8fafb] px-5 text-center text-[#15191e]">
      <section className="rounded-[14px] border border-[#e3e8ec] bg-white p-8 shadow-[0_18px_48px_rgba(21,25,30,0.08)]">
        <h1 className="text-[28px] font-extrabold">ClimaFy</h1>
        <p className="mt-2 text-[13px] text-[#66717f]">Abrindo a pagina de login...</p>
      </section>
    </main>
  );
}
