import { Link } from 'react-router-dom';

export default function AppLayout({ children }) {
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

          <nav className="absolute left-[624px] top-[23px] hidden items-start gap-[76px] text-[14px] leading-[17px] text-[#48525f] lg:flex">
            <a href="#mapa" className="relative font-semibold text-[#1a9651] after:absolute after:left-[3px] after:top-[37px] after:h-[3px] after:w-8 after:bg-[#1a9651]">
              Inicio
            </a>
            <a href="#ranking" className="hover:text-[#1a9651]">
              Ranking
            </a>
            <a href="#relatos" className="hover:text-[#1a9651]">
              Relatos
            </a>
            <a href="#sobre" className="hover:text-[#1a9651]">
              Sobre
            </a>
          </nav>

          <div className="absolute right-[72px] top-[16px] flex items-center gap-[33px] max-sm:right-5">
            <Link className="hidden text-[14px] font-medium leading-[17px] text-[#48525f] hover:text-[#1a9651] sm:inline-flex" to="/login">
              Entrar
            </Link>
            <a className="grid h-9 w-[98px] place-items-center rounded-lg bg-[#1a9651] text-[13px] font-semibold text-white hover:bg-[#116b38]" href="#relatar">
              + Relatar
            </a>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
