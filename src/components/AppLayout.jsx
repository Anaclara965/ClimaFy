import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

export default function AppLayout({ children }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeClass = 'relative font-semibold text-[#1a9651] after:absolute after:left-[3px] after:top-[37px] after:h-[3px] after:w-8 after:bg-[#1a9651]';
  const idleClass = 'hover:text-[#1a9651]';
  const mobileLinkClass = 'rounded-lg px-3 py-2 text-[14px] font-semibold text-[#48525f] hover:bg-[#e0f5e9] hover:text-[#116b38]';

  return (
    <div className="min-h-screen bg-[#f8fafb] text-[#15191e]">
      <header className="sticky top-0 z-[1000] h-[68px] border border-[#e3e8ec] bg-white shadow-[0_4px_76.2px_rgba(0,0,0,0.25)]">
        <div className="relative mx-auto h-full max-w-[1440px]">
          <Link to="/" className="absolute left-[72px] top-[18px] flex items-center gap-2 font-bold text-[#1a9651] max-sm:left-5">
            <span className="text-[22px] leading-none" aria-hidden="true">
              🌿
            </span>
            <span className="text-[20px] leading-6">ClimaFy</span>
          </Link>

          <nav className="absolute left-[624px] top-[23px] hidden items-start gap-[76px] text-[14px] leading-[17px] text-[#48525f] md:flex">
            <Link to="/" className={pathname === '/' ? activeClass : idleClass}>
              Inicio
            </Link>
            <Link to="/ranking" className={pathname === '/ranking' ? activeClass : idleClass}>
              Ranking
            </Link>
            <Link to="/relatos" className={pathname === '/relatos' ? activeClass : idleClass}>
              Relatos
            </Link>
            <Link to="/sobre" className={pathname === '/sobre' ? activeClass : idleClass}>
              Sobre
            </Link>
          </nav>

          <button className="absolute right-5 top-[16px] hidden h-9 w-10 place-items-center rounded-lg border border-[#dbe3e8] bg-white text-[18px] font-black text-[#15191e] max-md:grid" onClick={() => setMenuOpen((open) => !open)} type="button" aria-expanded={menuOpen} aria-label="Abrir menu">
            {menuOpen ? 'x' : '≡'}
          </button>

          <div className="absolute right-[72px] top-[16px] flex items-center gap-[33px] max-md:hidden">
            <Link className="hidden text-[14px] font-medium leading-[17px] text-[#48525f] hover:text-[#1a9651] sm:inline-flex" to="/login">
              Entrar
            </Link>
            <Link className="grid h-9 w-[98px] place-items-center rounded-lg bg-[#1a9651] text-[13px] font-semibold text-white hover:bg-[#116b38]" to="/novo-relato">
              + Relatar
            </Link>
          </div>
        </div>
        {menuOpen ? (
          <nav className="absolute inset-x-0 top-[68px] grid gap-1 border-b border-[#e3e8ec] bg-white px-5 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)] md:hidden" aria-label="Navegacao mobile">
            <Link className={mobileLinkClass} onClick={() => setMenuOpen(false)} to="/">Inicio</Link>
            <Link className={mobileLinkClass} onClick={() => setMenuOpen(false)} to="/ranking">Ranking</Link>
            <Link className={mobileLinkClass} onClick={() => setMenuOpen(false)} to="/relatos">Relatos</Link>
            <Link className={mobileLinkClass} onClick={() => setMenuOpen(false)} to="/sobre">Sobre</Link>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Link className="grid h-10 place-items-center rounded-lg border border-[#dbe3e8] text-[13px] font-semibold text-[#48525f]" onClick={() => setMenuOpen(false)} to="/login">Entrar</Link>
              <Link className="grid h-10 place-items-center rounded-lg bg-[#1a9651] text-[13px] font-semibold text-white" onClick={() => setMenuOpen(false)} to="/novo-relato">+ Relatar</Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main>{children}</main>
    </div>
  );
}
