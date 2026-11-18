import * as React from "react";
import { Reveal } from "@/shared/pt/motion";

// Хэсгийн гарчиг (нүүрний хэв маяг): жижиг улаан нүүрний бичиг, том гарчиг, тайлбар, баруун талд үйлдэл.
// Бичвэрүүд нь хэсэг бүрийн өмнөх агуулга хэвээр (content.ts).
export function SectionHead({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <Reveal className="mb-9 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[720px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
        <h2 className="pt-tight mt-3 text-[34px] font-semibold leading-[1.04] sm:text-[48px]">{title}</h2>
        {text ? <p className="mt-4 max-w-[560px] text-[16px] text-ink-500">{text}</p> : null}
      </div>
      {action}
    </Reveal>
  );
}
