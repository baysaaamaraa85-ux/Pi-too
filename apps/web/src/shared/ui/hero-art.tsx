// Самбарын долгионтой дэвсгэр (цэвэр SVG). Малгай, ном, том тэмдэг зэрэг чимэглэл байхгүй.

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
          <stop offset="55%" stopColor="#f1c9b5" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ecbba3" stopOpacity="0.32" />
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

// Shell-ийн дэвсгэр: дээд талд зөөлөн уусдаг долгион.
export function ShellBackdrop() {
  return (
    <HeroWaves className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 w-full [mask-image:linear-gradient(to_bottom,black_50%,transparent)] md:left-64 md:w-[calc(100%-16rem)]" />
  );
}
