import * as React from "react";
import "@/shared/pt/pt.css";

// Нийтийн дотоод хуудсуудын (Хөтөлбөр, Багш нар, Бидний тухай, Салбарууд, Холбогдох) нийтлэг бүрхүүл, D-86.
// Нүүр хуудастай ижил загвар: Onest фонт, цайвар дэвсгэр, шилэн шошго, том гарчиг. Цэс fixed тул дээд зайг гарчиг өөрөө авна.

export function PublicPage({ children }: { children: React.ReactNode }) {
  return <div className="pt-ui min-h-[70vh] overflow-x-clip bg-paper pb-4 text-ink-900">{children}</div>;
}

// Хуудасны толгой: шилэн шошго, том гарчиг (h1), тайлбар. `title` дотор улаанаар тодруулах үгийг <span className="text-brand-700"> гэж оруулна.
export function PageHead({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text?: string }) {
  return (
    <header className="relative px-4 pt-32 text-center sm:pt-36">
      <span className="pt-glyph left-[6%] top-[120px] hidden text-[110px] sm:block" aria-hidden="true">
        ∑
      </span>
      <span className="pt-glyph right-[8%] top-[150px] hidden text-[84px] sm:block" style={{ animationDelay: "-4s" }} aria-hidden="true">
        x²
      </span>
      <p className="pt-glass inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">
        <span className="size-1.5 rounded-full bg-brand-700" aria-hidden="true" />
        {eyebrow}
      </p>
      <h1 className="pt-tight relative mx-auto mt-6 max-w-[900px] text-[36px] font-semibold leading-[1.04] sm:text-[54px] lg:text-[64px]">{title}</h1>
      {text ? <p className="relative mx-auto mt-5 max-w-[560px] text-[16px] text-ink-500 sm:text-[18px]">{text}</p> : null}
    </header>
  );
}

// Хуудасны агуулгын хүрээ
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1240px] px-4 sm:px-6 ${className ?? ""}`}>{children}</div>;
}
