import * as React from "react";

// Нүүр хуудасны хөдөлгөөний хэрэгслүүд (hook). Хөдөлгөөн багасгах тохиргоотой хэрэглэгчид бүгд шууд харагдана (WCAG 2.3.3).

function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

export function useWindowWidth() {
  return React.useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth,
    () => 1280,
  );
}

// Элемент дэлгэцэнд анх орох үед true болно (дахин false болохгүй).
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(() => typeof IntersectionObserver === "undefined");
  React.useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return [ref, inView] as const;
}
