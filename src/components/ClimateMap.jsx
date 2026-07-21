const pins = [
  { left: '3%', top: '36%', color: '#2469d6' },
  { left: '11%', top: '17%', color: '#d62727' },
  { left: '27%', top: '41%', color: '#f37d22' },
  { left: '45%', top: '46%', color: '#2469d6' },
  { left: '58%', top: '31%', color: '#d62727' },
  { left: '70%', top: '20%', color: '#2469d6' },
  { left: '20%', top: '58%', color: '#63a93a' },
  { left: '38%', top: '66%', color: '#8b6328' },
  { left: '50%', top: '77%', color: '#f37d22' },
  { left: '16%', top: '76%', color: '#2469d6' },
];

const districts = [
  { name: 'Vila Madalena', left: '0.8%', top: '6%', width: '19.5%', height: '25%', border: '#d62727', fill: 'rgba(255,224,224,0.62)', text: '#d62727' },
  { name: 'Pinheiros', left: '22%', top: '10%', width: '15%', height: '22%', border: '#f37d22', fill: 'rgba(255,237,224,0.62)', text: '#f37d22' },
  { name: 'Consolacao', left: '39%', top: '6%', width: '17%', height: '24%', border: '#f0c21d', fill: 'rgba(255,246,214,0.65)', text: '#d9a600' },
  { name: 'Butanta', left: '1%', top: '38%', width: '22.8%', height: '24%', border: '#f0c21d', fill: 'rgba(255,246,214,0.65)', text: '#d9a600' },
  { name: 'Perdizes', left: '25%', top: '40%', width: '18.5%', height: '22%', border: '#63a93a', fill: 'rgba(224,245,233,0.72)', text: '#1a9651' },
  { name: 'Bras', left: '46%', top: '37%', width: '18%', height: '27%', border: '#d62727', fill: 'rgba(255,224,224,0.62)', text: '#d62727' },
  { name: 'Lapa', left: '9%', top: '66%', width: '17.5%', height: '21%', border: '#63a93a', fill: 'rgba(224,245,233,0.72)', text: '#1a9651' },
  { name: 'Mooca', left: '30.5%', top: '64%', width: '22.5%', height: '24%', border: '#f37d22', fill: 'rgba(255,237,224,0.62)', text: '#f37d22' },
];

const toPercent = (value, fallback) => {
  if (typeof value === 'number') return `${value}%`;
  return value ?? `${fallback}%`;
};

const normalizePin = (pin, index) => ({
  left: toPercent(pin.left ?? pin.x ?? pin.positionPercent?.x, 10 + index * 8),
  top: toPercent(pin.top ?? pin.y ?? pin.positionPercent?.y, 20 + index * 6),
  color: pin.color ?? pin.categoryColor ?? '#2469d6',
});

const normalizeDistrict = (district) => ({
  name: district.name ?? district.neighborhood ?? 'Bairro',
  left: district.left ?? `${district.bounds?.left ?? 4}%`,
  top: district.top ?? `${district.bounds?.top ?? 8}%`,
  width: district.width ?? `${district.bounds?.width ?? 18}%`,
  height: district.height ?? `${district.bounds?.height ?? 22}%`,
  border: district.border ?? district.color ?? '#f37d22',
  fill: district.fill ?? `${district.color ?? '#f37d22'}1f`,
  text: district.text ?? district.color ?? '#f37d22',
});

export default function ClimateMap({ data }) {
  const activePins = (data?.pins?.length ? data.pins : pins).map(normalizePin);
  const activeDistricts = (data?.districts?.length ? data.districts : data?.neighborhoods?.length ? data.neighborhoods : districts).map(normalizeDistrict);

  return (
    <div id="mapa" className="relative h-[460px] w-full overflow-hidden rounded-[20px] bg-[#d4dfd6] shadow-[0_8px_32px_rgba(0,0,0,0.15)] max-md:h-[calc(100vh-120px)] max-md:rounded-none">
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#f4f4f2_2px,transparent_2px),linear-gradient(90deg,#f4f4f2_2px,transparent_2px)] [background-size:67px_85px]" />
      <div className="absolute left-[56%] top-[23%] h-[177px] w-[115px] rounded-[14px] bg-[#abd3e7] text-center text-[11px] text-[#2469a3]">
        <span className="absolute left-1/2 top-[82px] -translate-x-1/2 whitespace-nowrap">Rio Tiete</span>
      </div>
      <div className="absolute left-[13%] top-[63%] h-[85px] w-[132px] rounded-lg bg-[#b7d8a3] text-center text-[10px] text-[#326e32]">
        <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap">Parque Central</span>
      </div>

      {activeDistricts.map((district) => (
        <div
          key={district.name}
          className="absolute grid place-items-center rounded-md border-[1.5px] text-[10px] font-semibold"
          style={{
            backgroundColor: district.fill,
            borderColor: district.border,
            color: district.text,
            height: district.height,
            left: district.left,
            top: district.top,
            width: district.width,
          }}
        >
          {district.name}
        </div>
      ))}

      {activePins.map((pin) => (
        <span
          className="absolute h-4 w-4 rounded-full border-2 border-white shadow-[0_3px_6px_rgba(0,0,0,0.25)]"
          key={`${pin.left}-${pin.top}`}
          style={{ backgroundColor: pin.color, left: pin.left, top: pin.top }}
        />
      ))}

      <aside className="absolute right-[10px] top-[9px] h-[396px] w-[184px] rounded-xl bg-white/95 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.12)] max-md:bottom-3 max-md:left-3 max-md:right-3 max-md:top-auto max-md:h-auto max-md:w-auto">
        <h3 className="text-[11px] font-bold text-[#15191e]">Legenda do Mapa</h3>
        <div className="mt-2 h-px bg-[#e3e8ec]" />
        <p className="mt-3 text-[9px] font-semibold uppercase text-[#8b96a3]">Vulnerabilidade</p>
        {[
          ['Critica', '#d62727'],
          ['Alta', '#f37d22'],
          ['Media', '#f0c21d'],
          ['Baixa', '#63a93a'],
        ].map(([label, color]) => (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-[#48525f]" key={label}>
            <span className="h-4 w-4 rounded-[3px]" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
        <div className="mt-4 h-px bg-[#e3e8ec]" />
        <p className="mt-3 text-[9px] font-semibold uppercase text-[#8b96a3]">Categoria</p>
        {[
          ['Alagamento', '#2469d6'],
          ['Queimada', '#d62727'],
          ['Calor Extremo', '#f35c22'],
          ['Arvore Caida', '#63a93a'],
          ['Lixo Irregular', '#8b6328'],
          ['Poluicao Agua', '#2469a3'],
          ['Outros', '#48525f'],
        ].map(([label, color]) => (
          <div className="mt-[9px] flex items-center gap-2 text-[10px] text-[#48525f]" key={label}>
            <span className="h-[14px] w-[14px] rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </aside>
    </div>
  );
}
