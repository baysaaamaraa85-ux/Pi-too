// Мэдэгдлийн загвар: outbox-ийн template + payload -> гарчиг, бичвэр (монгол хэлээр, ФБШ-11).
// Шинэ загвар нэмэхэд зөвхөн энэ файл өөрчлөгдөнө.

export interface RenderedNotification {
  title: string;
  body: string;
  url?: string;
}

type Payload = Record<string, unknown>;

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Ирсэн",
  EXCUSED: "Чөлөөтэй",
  OVER_LIMIT: "Чөлөө хэтэрсэн",
  MAKEUP: "Нөхөлт",
  FREE_REVIEW: "Үнэгүй давтлага",
};

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown): string => (typeof v === "number" ? String(v) : str(v));

// ФБШ-11: огноо ОООО.СС.ӨӨ цагтай, Asia/Ulaanbaatar.
function formatLocal(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const local = new Date(new Date(iso).getTime() + 8 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}.${p(local.getUTCMonth() + 1)}.${p(local.getUTCDate())} ${p(local.getUTCHours())}:${p(local.getUTCMinutes())}`;
}

export function renderNotification(
  template: string,
  payload: Payload,
  appOrigin: string,
): RenderedNotification {
  switch (template) {
    case "lesson_cancelled":
      return {
        title: "Хичээл цуцлагдлаа",
        body: `${formatLocal(payload.startsAt)} цагийн хичээл цуцлагдлаа.`,
        url: `${appOrigin}/portal/schedule`,
      };
    case "lesson_rescheduled":
      return {
        title: "Хичээлийн цаг өөрчлөгдлөө",
        body: `Хичээл ${formatLocal(payload.startsAt)} цагт шилжлээ.`,
        url: `${appOrigin}/portal/schedule`,
      };
    case "attendance_recorded":
    case "attendance_updated":
      return {
        title: template === "attendance_updated" ? "Ирц шинэчлэгдлээ" : "Ирц бүртгэгдлээ",
        body: `${str(payload.studentName)}: ${STATUS_LABELS[str(payload.status)] ?? str(payload.status)} (${formatLocal(payload.lessonStartsAt)}). Үлдсэн багц ${num(payload.remainingHours)} академик цаг, чөлөө ${num(payload.leavesLeft)}.`,
        url: `${appOrigin}/portal/attendance`,
      };
    case "package_ending":
      return {
        title: "Багц дуусахад ойртлоо",
        body: `${str(payload.studentName)}: үлдсэн багц ${num(payload.remainingHours)} академик цаг.`,
        url: `${appOrigin}/portal`,
      };
    case "leave_requested":
      return {
        title: "Чөлөөний хүсэлт",
        body: `${str(payload.studentName)} ${formatLocal(payload.startsAt)} цагийн хичээлээс чөлөө хүслээ.`,
        url: `${appOrigin}/teacher`,
      };
    case "assessment_recorded":
      return {
        title: "Сорилын дүн",
        body: `${str(payload.studentName)}: ${num(payload.totalPercent)}%.`,
        url: `${appOrigin}/portal`,
      };
    case "payment_recorded":
      return {
        title: "Төлбөр бүртгэгдлээ",
        body: `${str(payload.studentName)}: ${num(payload.amount)} ₮ бүртгэгдлээ. Үлдэгдэл ${num(payload.balance)} ₮.`,
        url: `${appOrigin}/portal/payment`,
      };
    case "payment_reminder":
      return {
        title: "Төлбөрийн сануулга",
        body: `${str(payload.studentName)}: ${str(payload.programName)} багцын төлбөр төлөгдөөгүй байна. Үлдэгдэл ${num(payload.balance)} ₮. Төлбөрийн заавар "Гэрээ, төлбөр" хэсэгт байна.`,
        url: `${appOrigin}/portal/payment`,
      };
    case "payment_claim_created":
      return {
        title: "Шилжүүлгийн мэдэгдэл",
        body: `${str(payload.studentName)}: төлбөр шилжүүлснээ мэдэгдлээ. Тулгана уу.`,
        url: `${appOrigin}/admin/payments`,
      };
    case "payment_claim_rejected":
      return {
        title: "Шилжүүлэг олдсонгүй",
        body: `${str(payload.studentName)}: ${str(payload.reason)}`,
        url: `${appOrigin}/portal/payment`,
      };
    // D-102: мэдэгдэлд хүүхэд, эцэг эхийн мэдээлэл оруулахгүй, хүсэлтийг системээс нээж харна.
    case "placement_request_new":
      return {
        title: "Шинэ түвшин тогтоох хүсэлт",
        body: `${str(payload.branchName, "Таны салбар")} салбарт түвшин тогтоох цаг захиалсан шинэ хүсэлт ирлээ. Эцэг эхтэй холбогдоно уу.`,
        url: `${appOrigin}/teacher/placement-requests`,
      };
    case "placement_request_forwarded":
      return {
        title: "Танд хүсэлт шилжүүлсэн",
        body: `${str(payload.branchName, "Салбар")}: салбарын ахлагч түвшин тогтоох хүсэлтийг танд шилжүүлсэн. Эцэг эхтэй холбогдоно уу.`,
        url: `${appOrigin}/teacher/placement-requests`,
      };
    case "branch_lead_assigned":
      return {
        title: "Салбарын ахлагчаар томилогдлоо",
        body: `Та "${str(payload.branchName)}" салбарын ахлагч боллоо. Түвшин тогтоох хүсэлтүүд танд очно.`,
        url: `${appOrigin}/teacher/placement-requests`,
      };
    case "password_reset":
      return {
        title: "Нууц үг сэргээх",
        body: `Нууц үгээ сэргээхийн тулд холбоосоор орно уу (30 минут хүчинтэй): ${appOrigin}/reset-password?token=${str(payload.token)}`,
        url: `${appOrigin}/reset-password?token=${str(payload.token)}`,
      };
    default:
      return { title: "Пи тоо", body: "Танд шинэ мэдэгдэл ирлээ.", url: appOrigin };
  }
}
