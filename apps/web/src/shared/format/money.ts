// ФБШ-11, CLAUDE.md 6.8: "125 000 ₮" хэлбэр. API-аас тэмдэгт мөрөөр ирнэ
// (жишээ нь "40000.00"), JavaScript number-оор тооцохгүй, зөвхөн харуулна.
export function formatMoney(value: string): string {
  const [whole] = value.split(".");
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} ₮`;
}

// Мөнгөн тэмдэгт мөрүүдийг (жишээ нь "-10000.50") BigInt-ээр цент болгож нэмнэ:
// хөвөгч таслалтай number ашиглахгүй (ФБШ-02). Зөвхөн харуулах нийлбэрт.
export function sumMoney(values: string[]): string {
  const cents = values.reduce((acc, v) => {
    const negative = v.startsWith("-");
    const [whole = "0", frac = ""] = v.replace("-", "").split(".");
    const c = BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
    return acc + (negative ? -c : c);
  }, 0n);
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}
