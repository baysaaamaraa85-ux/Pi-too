// ФБШ-11, CLAUDE.md 6.8: "125 000 ₮" хэлбэр. API-аас тэмдэгт мөрөөр ирнэ
// (жишээ нь "40000.00"), JavaScript number-оор тооцохгүй, зөвхөн харуулна.
export function formatMoney(value: string): string {
  const [whole] = value.split(".");
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} ₮`;
}
