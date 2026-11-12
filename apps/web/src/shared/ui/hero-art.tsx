// Баннерын чимэглэл: долгионтой зураасан дэвсгэр, төгсөлтийн малгай ба номны овоолго.
// Цэвэр SVG тул дэлгэцийн хэмжээнээс үл хамааран тод харагдана.

export function HeroWaves({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 240"
      preserveAspectRatio="none"
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
    >
      <defs>
        <linearGradient id="hw-peach" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6dccd" stopOpacity="0.15" />
          <stop offset="55%" stopColor="#f1c9b5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ecbba3" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="hw-white" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d="M0,150 C230,60 430,200 680,120 C900,50 1040,20 1200,70 L1200,0 L0,0 Z" fill="url(#hw-peach)" />
      <path d="M0,200 C260,120 470,230 720,165 C940,108 1070,84 1200,128 L1200,240 L0,240 Z" fill="url(#hw-white)" />
      <path
        d="M0,168 C250,86 470,214 710,146 S1060,52 1200,102"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.95"
        strokeWidth="2.5"
      />
      <path
        d="M0,186 C260,108 480,232 722,162 S1070,76 1200,120"
        fill="none"
        stroke="#e9b9a0"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Sparkle({ x, y, size, opacity = 1 }: { x: number; y: number; size: number; opacity?: number }) {
  const s = size;
  return (
    <path
      transform={`translate(${x} ${y})`}
      d={`M0,${-s} C${s * 0.12},${-s * 0.12} ${s * 0.12},${-s * 0.12} ${s},0 C${s * 0.12},${s * 0.12} ${s * 0.12},${s * 0.12} 0,${s} C${-s * 0.12},${s * 0.12} ${-s * 0.12},${s * 0.12} ${-s},0 C${-s * 0.12},${-s * 0.12} ${-s * 0.12},${-s * 0.12} 0,${-s} Z`}
      fill="#e0b24a"
      opacity={opacity}
    />
  );
}

export function CapAndBooks({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 380 240" className={className} role="presentation">
      <defs>
        <linearGradient id="cb-board" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#0f0f0f" />
        </linearGradient>
        <linearGradient id="cb-book1" x1="0" x2="1">
          <stop offset="0%" stopColor="#e7ad92" />
          <stop offset="100%" stopColor="#f3c8b0" />
        </linearGradient>
        <linearGradient id="cb-book2" x1="0" x2="1">
          <stop offset="0%" stopColor="#f8dccb" />
          <stop offset="100%" stopColor="#fbeadf" />
        </linearGradient>
        <linearGradient id="cb-book3" x1="0" x2="1">
          <stop offset="0%" stopColor="#d99a80" />
          <stop offset="100%" stopColor="#ecb89f" />
        </linearGradient>
        <filter id="cb-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#8b1a1a" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter="url(#cb-shadow)">
        {/* Номны овоолго */}
        <rect x="46" y="176" width="292" height="40" rx="10" fill="url(#cb-book1)" />
        <rect x="46" y="196" width="292" height="12" rx="6" fill="#fff4ec" opacity="0.85" />
        <rect x="70" y="140" width="246" height="38" rx="10" fill="url(#cb-book2)" />
        <rect x="70" y="160" width="246" height="11" rx="5.5" fill="#fff9f4" opacity="0.9" />
        <rect x="56" y="106" width="266" height="36" rx="10" fill="url(#cb-book3)" />
        <rect x="56" y="125" width="266" height="11" rx="5.5" fill="#fff1e7" opacity="0.85" />
      </g>

      {/* Малгайн доод хэсэг */}
      <path d="M118 78 V112 C118 132 154 144 190 144 C226 144 262 132 262 112 V78 Z" fill="#232323" />
      <path d="M118 96 C140 112 240 112 262 96" fill="none" stroke="#3b3b3b" strokeWidth="2" />
      {/* Малгайн дээд хавтан */}
      <polygon points="190,22 340,66 190,110 40,66" fill="url(#cb-board)" />
      <polygon points="190,22 340,66 190,70 40,66" fill="#4a4a4a" opacity="0.55" />
      <polyline points="40,66 190,110 340,66" fill="none" stroke="#5b5b5b" strokeWidth="1.5" />
      <circle cx="190" cy="66" r="5" fill="#c9a84c" />
      {/* Зах (tassel) */}
      <path d="M190 66 C240 70 284 72 304 78" fill="none" stroke="#d8ae3f" strokeWidth="3" strokeLinecap="round" />
      <path d="M304 78 V124" fill="none" stroke="#d8ae3f" strokeWidth="3" strokeLinecap="round" />
      <rect x="297" y="120" width="14" height="30" rx="5" fill="#e0b24a" />
      <rect x="297" y="120" width="14" height="6" rx="3" fill="#b98a28" />

      <Sparkle x={26} y={86} size={20} />
      <Sparkle x={60} y={54} size={9} opacity={0.8} />
    </svg>
  );
}

// Shell-ийн дэвсгэр: долгион (зөөлөн уусдаг), хүсвэл том π тэмдэг.
export function ShellBackdrop({ watermark = true }: { watermark?: boolean }) {
  return (
    <>
      <HeroWaves className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 w-full [mask-image:linear-gradient(to_bottom,black_55%,transparent)] md:left-64 md:w-[calc(100%-16rem)]" />
      {watermark ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-6 top-6 z-0 hidden select-none font-display text-[12rem] font-black leading-none text-primary/[0.07] md:block"
        >
          π
        </span>
      ) : null}
    </>
  );
}
