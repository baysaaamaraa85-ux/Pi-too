import { ArrowRight, Phone } from "lucide-react";
import { Link } from "react-router";
import { SITE } from "../content";
import type { PublicOverview } from "../public-api";
import { GRADES_RANGE, packageLabel } from "./benefits";
import { Reveal } from "@/shared/pt/motion";

// Эцсийн дуудлага: бүртгүүлэх, шууд залгах. Тоонууд журмын тохиргооноос (ФБШ-29).
export function FinalCta({ overview }: { overview: PublicOverview | undefined }) {
  const facts = [GRADES_RANGE, packageLabel(overview), overview ? `Нэг багш 2–${overview.classCapacity} сурагч` : "Цөөн сурагчтай анги"];
  return (
    <section className="mt-24 scroll-mt-24 sm:mt-32">
      <Reveal className="pt-dark relative overflow-hidden rounded-[36px] bg-[#141110] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(45% 60% at 50% 45%,rgba(139,26,26,.6),transparent 70%),radial-gradient(30% 40% at 85% 90%,rgba(242,174,58,.18),transparent 70%)",
          }}
        />
        <div className="pt-dots" />
        <div className="pt-noise" />
        <div className="relative mx-auto grid size-[150px] place-items-center" aria-hidden="true">
          <div className="pt-orb-ring" style={{ inset: -26 }} />
          <div className="pt-orb-core grid size-[110px] place-items-center">
            <span className="text-[46px] font-semibold drop-shadow" style={{ textShadow: "0 2px 14px rgba(74,10,10,.8)" }}>
              π
            </span>
          </div>
        </div>
        <h2 className="pt-tight relative mx-auto mt-10 max-w-[760px] text-[34px] font-semibold leading-[1.02] sm:text-[54px]">
          Хүүхдийнхээ <span className="text-gold-300">математикийн амжилтыг</span> өнөөдөр эхлүүлээрэй
        </h2>
        <p className="relative mt-4 text-[16px] text-white/60">{facts.join(" · ")}</p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            to="/contact"
            className="inline-flex h-[52px] items-center gap-2 rounded-full bg-brand-700 px-7 text-[15px] font-medium text-white shadow-[0_16px_40px_-12px_rgba(139,26,26,0.9)] ring-1 ring-white/15 transition hover:bg-brand-600"
          >
            Бүртгүүлэх <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href={`tel:+976${SITE.phone}`}
            className="inline-flex h-[52px] items-center gap-2 rounded-full border border-white/15 bg-white/10 px-7 text-[15px] font-medium transition hover:bg-white/15"
          >
            <Phone className="size-4" aria-hidden="true" />
            Бидэнтэй шууд холбогдох
          </a>
        </div>
      </Reveal>
    </section>
  );
}
