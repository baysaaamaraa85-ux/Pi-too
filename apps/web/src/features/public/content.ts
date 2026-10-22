// Нийтийн сайтын агуулга (хуучин сайтын home.json-оос). Багшийн дэлгэрэнгүй,
// сэтгэгдэл зэрэг нь маркетингийн агуулга тул өгөгдлийн сангаас биш эндээс.
export const SITE = { brand: "Пи тоо", phone: "88118993", email: "info@pitoo.mn" };

export const HERO_BENEFITS = [
  "Нэг багш 2-6 сурагч",
  "Тухайн сурагчид зориулсан тусгай төлөвлөгөө",
  "Хуваариа сурагч өөрөө сонгох",
  "3 удаа чөлөө авахад багш нэмэлт цаг нөхөж өгнө",
  "93 хувиас доош хийвэл үнэ төлбөргүй нэмэлт давтлага өгнө",
];

export const STATS = [
  { value: "6", label: "Нэг ангид сурагч" },
  { value: "75", label: "Цаг" },
  { value: "Personal Plan", label: "", small: true },
  { value: "8", label: "Салбар" },
];

export interface ProgramItem {
  title: string;
  description: string;
}
export interface ProgramSection {
  id: "international" | "mongolian" | "school-exams";
  tabLabel: string;
  preview: string;
  teaserTitle: string;
  items: ProgramItem[];
}

export const PROGRAM_SECTIONS: ProgramSection[] = [
  {
    id: "international",
    tabLabel: "Олон улсын хөтөлбөр",
    teaserTitle: "Олон улсын хөтөлбөр",
    preview: "Cambridge · IB · AP · SAT болон бусад",
    items: [
      {
        title: "AS болон A Level",
        description: "Кембрижийн дэвшилтэт математикийн хөтөлбөр. Их сургуульд элсэхэд зориулсан.",
      },
      {
        title: "IGCSE болон CHECKPOINT",
        description: "Олон улсын ерөнхий боловсролын гэрчилгээний шалгалтад бэлтгэх хөтөлбөр.",
      },
      {
        title: "IB болон AP",
        description: "Олон улсын бакалаврын болон ахисан түвшний математикийн хөтөлбөр.",
      },
      {
        title: "SAT болон Olympiad",
        description:
          "Америкийн их сургуулийн элсэлтийн шалгалт (SAT) болон олон улсын математикийн олимпиадад бэлтгэнэ.",
      },
    ],
  },
  {
    id: "mongolian",
    tabLabel: "Монгол хөтөлбөр",
    teaserTitle: "Монгол хөтөлбөр",
    preview: "Хоцрогдол арилгах · ЭЕШ · Олимпиад болон бусад",
    items: [
      {
        title: "Хоцрогдол арилгах",
        description:
          "Сурагчийн мэдлэгийн сул талыг тодорхойлж, хоцорсон сэдвүүдийг системтэй нөхөж сургана.",
      },
      {
        title: "Түвшин ахиулах",
        description:
          "Сурагчийн одоогийн түвшинг тогтоож, зорилгодоо хүрэхийн тулд бие даасан төлөвлөгөө гарган ажиллана.",
      },
      {
        title: "Олимпиад бэлтгэл",
        description: "Аймаг, улсын математикийн олимпиадад ахисан түвшинд бэлтгэнэ.",
      },
      {
        title: "ЭЕШ бэлтгэл",
        description: "Элсэлтийн ерөнхий шалгалтад 700+ оноо авах зорилгоор системтэй бэлтгэнэ.",
      },
    ],
  },
  {
    id: "school-exams",
    tabLabel: "Сургуулийн шалгалт",
    teaserTitle: "Сургуулийн шалгалтад бэлтгэх",
    preview: "Шинэ эрин · Монгол тэмүүлэл болон бусад сургууль",
    items: [
      {
        title: "Шинэ эрин",
        description:
          "Шинэ эрин сургуулийн элсэлтийн болон улирлын шалгалтад бэлтгэх тусгай хөтөлбөр.",
      },
      {
        title: "Монгол тэмүүлэл",
        description: "Монгол тэмүүлэл сургуулийн математикийн шалгалтад нийцсэн бэлтгэл хөтөлбөр.",
      },
      {
        title: "Бусад сургуулиуд",
        description: "Бусад шилдэг болон хувийн сургуулиудын элсэлт, дотоод шалгалтад бэлтгэнэ.",
      },
    ],
  },
];

export interface TeacherCard {
  name: string;
  branch: string;
  specialties: string[];
  photo?: string;
}

export const TEACHERS: TeacherCard[] = [
  {
    name: "А.Баясгалан",
    branch: "УБ Төв",
    specialties: ["AS & A Level", "IGCSE", "IB"],
    photo: "/images/teachers/baysgalan.png",
  },
  {
    name: "Амирлангуй",
    branch: "Хан-Уул",
    specialties: ["ЭЕШ бэлтгэл", "Олимпиадын бэлтгэл"],
    photo: "/images/teachers/amirlangui.jpg",
  },
  {
    name: "Ч.Энхбилэг",
    branch: "Баянзүрх",
    specialties: ["Түвшин ахиулах", "Хоцрогдол арилгах"],
    photo: "/images/teachers/enkhbileg.jpg",
  },
  { name: "Н.Оюунгэрэл", branch: "Баянзүрх", specialties: ["ЭЕШ", "Олимпиад"] },
  { name: "Г.Энхтуяа", branch: "УБ Төв", specialties: ["Математик"] },
];

export const REVIEWS = [
  {
    author: "Б. Нарантуяа",
    role: "Эцэг эх",
    text: "Миний хүүхэд математикийн дүнгээ 40-өөс 85 болгож ахиулсан. Багш нар маш мэргэжлийн түвшинд заадаг.",
  },
  {
    author: "Д. Энхбаяр",
    role: "Эцэг эх",
    text: "Хүүхдийн ирцийг бодит цагаар хянах боломжтой, багцын үлдэгдэл ойлгомжтой харагддаг нь маш тухтай.",
  },
  {
    author: "Г. Оюунцэцэг",
    role: "Эцэг эх",
    text: "Хүүхдээ олимпиадад бэлтгүүлж, улсын шилдэг 10-т орсон. Пи тоо багт баярлалаа!",
  },
];

export const STEPS = [
  {
    title: "Түвшин тогтоолгох цаг захиалах",
    description: "Бид тантай холбогдоно. Та өөрийн мэдээллээ үлдээнэ үү.",
    to: "/contact",
  },
  {
    title: "Багшаа сонгох",
    description: "Түвшингээ тогтоолгосны дараа тохирох багшаа сонгоно.",
  },
  {
    title: "Хичээлээ эхлүүлэх",
    description: "Дэлгэрэнгүй бүртгэлээ хийгээд, төлбөрөө төлж хичээлээ эхлүүлээрэй.",
  },
];

export const PACKAGES = [
  { name: "Монгол стандарт", price: "1 200 000 ₮" },
  { name: "Олон улсын стандарт", price: "1 800 000 ₮" },
];
