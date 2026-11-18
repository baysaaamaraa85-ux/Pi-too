import * as React from "react";
import { cn } from "@/shared/ui/utils";
import { useInView } from "./use-motion";

// Нүүр хуудасны хөдөлгөөний жижиг хэрэгсэл: харагдах үед тодрох (Reveal).
// Хөдөлгөөн багасгах тохиргоотой хэрэглэгчид бүгд шууд харагдана (WCAG 2.3.3, home.css мөн адил).

type RevealTag = "div" | "article" | "section" | "li";

// Гүйлгэхэд харагдах үед бүдэг байснаа тодорно. Элемент нь `onInView` өгвөл тодорсны дараа мэдэгдэнэ (дугуйн цэгүүд гэх мэт).
export function Reveal({
  as = "div",
  delay = 0,
  className,
  style,
  children,
  onPointerMove,
  onInView,
}: {
  as?: RevealTag;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onPointerMove?: React.PointerEventHandler<HTMLElement>;
  onInView?: (inView: boolean) => void;
}) {
  const [ref, inView] = useInView<HTMLElement>(0.2);
  // Хоцрогдлыг зөвхөн тодрох үед хэрэглэнэ: дараа нь hover хөдөлгөөнийг удаашруулахгүй.
  const [settled, setSettled] = React.useState(false);
  React.useEffect(() => {
    onInView?.(inView);
  }, [inView, onInView]);
  React.useEffect(() => {
    if (!inView || !delay) return;
    const t = window.setTimeout(() => setSettled(true), 900 + delay);
    return () => window.clearTimeout(t);
  }, [inView, delay]);
  return React.createElement(
    as,
    {
      ref,
      "data-in": inView,
      onPointerMove,
      className: cn("pt-reveal", className),
      style: { ...style, transitionDelay: delay && !settled ? `${delay}ms` : undefined },
    },
    children,
  );
}
