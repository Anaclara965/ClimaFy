import { Link } from 'react-router-dom';
import Pill from '../components/Pill.jsx';

export default function PlaceholderPage({ eyebrow = 'ClimaFy', title, description, ctaLabel, ctaTo = '/' }) {
  return (
    <section className="min-h-[calc(100vh-136px)] px-5 py-16 lg:px-[72px]">
      <div className="mx-auto max-w-[760px] rounded-[14px] border border-[#e3e8ec] bg-white p-8 shadow-[0_18px_48px_rgba(21,25,30,0.08)]">
        <Pill>{eyebrow}</Pill>
        <h1 className="mt-5 text-[34px] font-extrabold leading-[42px] text-[#15191e]">{title}</h1>
        <p className="mt-4 text-[15px] leading-6 text-[#66717f]">{description}</p>
        {ctaLabel ? (
          <Link className="mt-7 inline-grid h-11 place-items-center rounded-lg bg-[#1a9651] px-5 text-[13px] font-bold text-white transition hover:bg-[#116b38]" to={ctaTo}>
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}