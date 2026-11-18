import * as React from "react";
import { Link } from "react-router";
import { STEPS } from "../content";
import { Reveal } from "@/shared/pt/motion";
import { SectionHead } from "./section-head";

// Хэрхэн ажилладаг: өмнөх 3 алхам, бичвэр, холбоос хэвээр. Загвар нь харанхуй cover дээр том гэрэлтдэг тоо, доор бүдэг өнгөт хэсэг.
const STYLES = [
  { hue: "139,26,26", tint: "#F6E9E9" },
  { hue: "242,174,58", tint: "#F8F0E2" },
  { hue: "76,194,126", tint: "#EAF5EE" },
] as const;

export function StepsSection() {
  return (
    <section className="mt-20 sm:mt-28">
      <SectionHead
        eyebrow="Хэрхэн ажилладаг"
        title={<><span className="text-brand-700">3 алхмаар</span> бүртгүүлээрэй</>}
        text="Та холбогдох мэдээллээ үлдээхэд л болно. Бид тантай холбогдъё."
      />
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const style = STYLES[i % STYLES.length]!;
          const body = (
            <>
              <div className="pt-cover pt-dark grid h-[120px] place-items-center">
                <div className="pt-glow" style={{ background: `radial-gradient(40% 50% at 50% 55%,rgba(${style.hue},.55),transparent 70%)` }} />
                <div className="pt-dots" />
                <div className="pt-noise" />
                <span
                  className="pt-tight pt-num relative text-[64px] font-semibold leading-none text-white transition-transform duration-500 group-hover:scale-110"
                  style={{ textShadow: `0 0 36px rgba(${style.hue},.9)` }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              </div>
              <div className="pt-meta flex-1 px-5 py-4">
                <h3 className="text-[17px] font-semibold leading-snug">{step.title}</h3>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-ink-500">{step.description}</p>
              </div>
            </>
          );
          return (
            <Reveal key={step.title} as="li" delay={i * 60} className="pt-lib group flex flex-col" style={{ "--tint": style.tint } as React.CSSProperties}>
              {step.to ? (
                <Link to={step.to} className="flex h-full flex-col">
                  {body}
                </Link>
              ) : (
                <div className="flex h-full flex-col">{body}</div>
              )}
            </Reveal>
          );
        })}
      </ol>
    </section>
  );
}
