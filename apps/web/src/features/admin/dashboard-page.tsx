import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, BellRing, Check, CircleAlert, ClipboardList, FileText, Plus, Wallet } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { useAdminDashboard } from "@/features/dashboard/dashboard-api";
import { api } from "@/shared/api-client/client";
import type { PlacementRequestDto } from "@/shared/api-client/types";
import { formatDate, weekdayName, weekdayOf } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Reveal } from "@/shared/pt/motion";
import "@/shared/pt/pt.css";
import { ADMIN_ACTIONS, ADMIN_SETUP, type AdminLink } from "./admin-links";

// Захирлын самбар (D-88, admin_dashboard_v2.html): "үйлдэлд хөтлөх" гурван карт (ФШ-68: өртэй гэрээ, сөрөг үлдэгдэлтэй багш,
// шинэ хүсэлт), дарахад шүүлттэй жагсаалт нээгдэнэ. Доор тохиргооны сонголт ба шуурхай үйлдэл. Өгөгдөл, холбоос өмнөхтэй ижил.

const MAX_TOKENS = 6;
const TOKEN_COLORS = ["#F7C978", "#B54848", "#F2AE3A", "#E7BDBD"];

function Title({ attention }: { attention: number | null }) {
  const [now] = React.useState(() => new Date());
  return (
    <section className="mt-8 flex flex-col justify-between gap-5 md:flex-row md:items-end lg:mt-10">
      <div>
        <p
          className="pt-word pt-glass pt-num h-8 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium text-ink-600"
          style={{ animationDelay: "0.05s", display: "inline-flex" }}
        >
          <span className="size-1.5 rounded-full bg-success shadow-[0_0_0_4px_rgba(29,122,70,0.15)]" aria-hidden="true" />
          {formatDate(now)} · {weekdayName(weekdayOf(now))}
        </p>
        <h1 className="pt-tight mt-4 text-[38px] font-semibold leading-[1.02] sm:text-[52px] lg:text-[58px]">
          <span className="pt-word" style={{ animationDelay: "0.15s" }}>
            Захирлын
          </span>{" "}
          <span className="pt-word text-brand-700" style={{ animationDelay: "0.25s" }}>
            самбар
          </span>
        </h1>
        <p className="pt-word mt-3 text-[15.5px] text-ink-500" style={{ animationDelay: "0.45s", display: "block" }}>
          Анхаарах зүйлс ба шуурхай үйлдлүүд
        </p>
      </div>
      {attention === null ? null : (
        <div className="pt-word" style={{ animationDelay: "0.55s", display: "block" }}>
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-paper-3 bg-white pl-2 pr-4 text-[13.5px] font-semibold">
            {attention > 0 ? (
              <span className="grid size-7 place-items-center rounded-full bg-gold-400 text-ink-900">
                <BellRing className="size-3.5" aria-hidden="true" />
              </span>
            ) : (
              <span className="grid size-7 place-items-center rounded-full bg-success text-white">
                <Check className="size-3.5" aria-hidden="true" />
              </span>
            )}
            {attention > 0 ? `${attention} зүйл анхаарал шаардаж байна` : "Бүх зүйл хэвийн"}
          </span>
        </div>
      )}
    </section>
  );
}

// Үлдэгдэлтэй гэрээ: том харанхуй карт. Бүхэл карт холбоос (testid kpi-debts), доторх товчнууд дээгүүр.
function DebtsCard({ count, total }: { count: number | null; total: string | null }) {
  const alert = count !== null && count > 0;
  return (
    <Reveal
      as="article"
      className="pt-dark relative flex min-h-[340px] flex-col overflow-hidden rounded-[32px] bg-[#141110] p-6 text-white sm:p-8 lg:col-span-7 lg:row-span-2"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 80% 15%,rgba(139,26,26,.75),transparent 70%),radial-gradient(40% 45% at 5% 100%,rgba(242,174,58,.18),transparent 70%)",
        }}
      />
      <div className="pt-dots" />
      <div className="pt-noise" />
      <Link
        to="/admin/payments?tab=debts"
        data-testid="kpi-debts"
        aria-label="Үлдэгдэлтэй гэрээ"
        className="absolute inset-0 z-10 rounded-[32px] outline-offset-[-4px]"
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 text-[12.5px] font-medium text-white/85">
          <FileText className="size-3.5 text-gold-300" aria-hidden="true" />
          Үлдэгдэлтэй гэрээ
        </span>
        {alert ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gold-400 px-3 text-[12px] font-bold text-ink-900">
            <CircleAlert className="size-3.5" aria-hidden="true" />
            Анхаарах
          </span>
        ) : null}
      </div>

      <div className="relative mt-8 flex flex-wrap items-end gap-x-8 gap-y-6">
        <div>
          <div className="text-[13px] text-white/60">Нийт үлдэгдэл</div>
          <div className="pt-tight pt-num mt-2 text-[40px] font-semibold leading-none sm:text-[56px]" style={{ textShadow: "0 0 40px rgba(242,174,58,.25)" }}>
            {total === null ? "..." : formatMoney(total)}
          </div>
        </div>
        <div className="pb-1">
          <div className="text-[13px] text-white/60">Гэрээ</div>
          <div className="pt-tight pt-num mt-2 text-[46px] font-semibold leading-none sm:text-[60px]" data-testid="kpi-debts-count">
            {count ?? "..."}
          </div>
        </div>
      </div>

      <div className="relative mt-8 flex items-center gap-3" aria-hidden="true">
        {Array.from({ length: Math.min(count ?? 0, MAX_TOKENS) }, (_, i) => {
          const c = TOKEN_COLORS[i % TOKEN_COLORS.length]!;
          return (
            <span
              key={i}
              className="pt-breathe grid size-10 place-items-center rounded-[12px] text-ink-900"
              style={{
                background: `radial-gradient(circle at 35% 30%,#fff,${c} 55%,${c})`,
                boxShadow: `0 0 22px ${c}99`,
                animationDuration: `${4 + i * 0.5}s`,
              }}
            >
              <FileText className="size-4" />
            </span>
          );
        })}
        {alert ? <span className="ml-1 text-[12.5px] text-white/60">{count} гэрээ төлбөр хүлээгдэж байна</span> : null}
      </div>

      <div className="relative z-20 mt-auto flex flex-wrap gap-2.5 pt-8">
        <Link
          to="/admin/payments?tab=debts"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-brand-800 transition hover:bg-paper-2"
        >
          Гэрээнүүдийг харах <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          to="/admin/payments"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-[14px] font-medium transition hover:bg-white/10"
        >
          <Plus className="size-4" aria-hidden="true" />
          Төлбөр бүртгэх
        </Link>
      </div>
    </Reveal>
  );
}

// Жижиг үзүүлэлтийн карт: цагаан, баруун талд харанхуй гэрэлтдэг дүрс. Бүхэл карт холбоос.
function SmallCard({
  to,
  testId,
  valueTestId,
  label,
  value,
  unit,
  tag,
  icon: Icon,
  hue,
  delay,
}: {
  to: string;
  testId: string;
  valueTestId: string;
  label: string;
  value: React.ReactNode;
  unit: React.ReactNode;
  tag: React.ReactNode;
  icon: typeof Wallet;
  hue: string;
  delay: number;
}) {
  return (
    <Reveal as="div" delay={delay} className="lg:col-span-5">
      <Link
        to={to}
        data-testid={testId}
        className="group flex items-center justify-between gap-5 rounded-[28px] border border-paper-3 bg-white p-6 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-14px_rgba(23,23,23,0.12)] transition-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <div>
          <div className="text-[13px] font-medium text-ink-500">{label}</div>
          <div className="mt-3 flex items-end gap-3">
            <span className="pt-tight pt-num text-[46px] font-semibold leading-none" data-testid={valueTestId}>
              {value}
            </span>
            <span className="pt-num pb-1 text-[15px] font-semibold text-ink-500">{unit}</span>
          </div>
          <div className="mt-3">{tag}</div>
        </div>
        <div className="pt-dark relative grid size-[104px] shrink-0 place-items-center overflow-hidden rounded-[26px] bg-[#141110]">
          <div className="absolute inset-0" style={{ background: `radial-gradient(60% 60% at 50% 50%,rgba(${hue},.45),transparent 75%)` }} />
          <div className="pt-dots" />
          <span
            className="relative grid size-12 place-items-center rounded-[16px] text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.04))",
              border: "1px solid rgba(255,255,255,.22)",
              boxShadow: `0 0 30px rgba(${hue},.5)`,
            }}
            aria-hidden="true"
          >
            <Icon className="size-6" />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

const okTag = (
  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-success-bg px-3 text-[12px] font-bold text-success">
    <Check className="size-3.5" aria-hidden="true" />
    Сайн байна
  </span>
);

// Тохиргоо, шуурхай үйлдлийн хэсгийн гарчиг
function Head({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <Reveal>
      <p className="text-[13px] font-medium text-brand-700">{eyebrow}</p>
      <h2 id={id} className="pt-tight mt-1 text-[28px] font-semibold leading-tight sm:text-[34px]">
        {title}
      </h2>
    </Reveal>
  );
}

// Холбоостой "library" карт: харанхуй гэрэлтдэг cover, доор бүдэг өнгөт хэсэг
function LinkCard({ link, index, tall }: { link: AdminLink; index: number; tall: boolean }) {
  return (
    <Reveal as="li" delay={index * 60} className="pt-lib group flex" style={{ "--tint": link.tint } as React.CSSProperties}>
      <Link to={link.to} className="flex w-full flex-col">
        <div className={tall ? "pt-cover pt-dark grid h-[92px] place-items-center sm:h-[120px]" : "pt-cover pt-dark grid h-[104px] place-items-center sm:h-[118px]"}>
          <div className="pt-glow" style={{ background: `radial-gradient(40% 50% at 50% 55%,rgba(${link.hue},.55),transparent 70%)` }} />
          <div className="pt-dots" />
          <div className="pt-noise" />
          <span
            className={
              tall
                ? "relative grid size-14 place-items-center rounded-[18px] text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
                : "relative grid size-12 place-items-center rounded-[16px] text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
            }
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.04))",
              border: "1px solid rgba(255,255,255,.22)",
              boxShadow: `0 0 36px rgba(${link.hue},.55),inset 0 1px 0 rgba(255,255,255,.3)`,
            }}
            aria-hidden="true"
          >
            <link.icon className={tall ? "size-6" : "size-5"} />
          </span>
        </div>
        <div className="pt-meta flex flex-1 items-start justify-between gap-3 px-5 py-4">
          <span className="text-[15px] font-semibold leading-snug">{link.label}</span>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-ink-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden="true" />
        </div>
      </Link>
    </Reveal>
  );
}

export function AdminDashboardPage() {
  const dash = useAdminDashboard();
  const requests = useQuery({
    queryKey: ["placement-requests", "NEW"],
    queryFn: () => api.get<PlacementRequestDto[]>("/placement-requests?status=NEW"),
  });
  const d = dash.data;
  const debts = d?.debts.count ?? null;
  const negative = d?.negativeTeachers.count ?? null;
  const reqCount = requests.data?.length ?? null;
  const attention = debts === null || negative === null || reqCount === null ? null : [debts, negative, reqCount].filter((n) => n > 0).length;

  return (
    <>
      <Title attention={attention} />

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5" aria-label="Анхаарах зүйлс">
        <DebtsCard count={debts} total={d?.debts.totalDebt ?? null} />
        <SmallCard
          to="/admin/payroll?negative=1"
          testId="kpi-negative-teachers"
          valueTestId="kpi-negative-teachers-count"
          label="Сөрөг үлдэгдэлтэй багш"
          value={negative ?? "..."}
          unit={d ? formatMoney(d.negativeTeachers.totalNegative) : null}
          tag={negative === 0 ? okTag : null}
          icon={Wallet}
          hue="76,194,126"
          delay={100}
        />
        <SmallCard
          to="/admin/requests"
          testId="kpi-requests"
          valueTestId="kpi-requests-count"
          label="Түвшин тогтоох хүсэлт"
          value={reqCount ?? "..."}
          unit="шинэ хүсэлт"
          tag={
            <span className="inline-flex h-7 items-center gap-1.5 text-[13px] font-semibold text-brand-700 transition-all group-hover:gap-2.5">
              Хүсэлтүүд <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          }
          icon={ClipboardList}
          hue="242,174,58"
          delay={200}
        />
      </section>

      <section className="mt-14" aria-labelledby="setup-title">
        <Head eyebrow="Тохиргоо" title="Тохиргооны сонголтууд" id="setup-title" />
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ADMIN_SETUP.map((l, i) => (
            <LinkCard key={l.to + l.label} link={l} index={i} tall />
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="actions-title">
        <Head eyebrow="Шуурхай үйлдлүүд" title="Нэг товшилтоор" id="actions-title" />
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
          {ADMIN_ACTIONS.map((l, i) => (
            <LinkCard key={l.label} link={l} index={i} tall={false} />
          ))}
        </ul>
      </section>
    </>
  );
}
