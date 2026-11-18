import { ArcCarousel } from "./home/arc-carousel";
import { FinalCta } from "./home/final-cta";
import { Hero } from "./home/hero";
import { ProgramsSection } from "./home/programs-section";
import { ReviewsSection } from "./home/reviews-section";
import { StepsSection } from "./home/steps-section";
import { TeachersSection } from "./home/teachers-section";
import "@/shared/pt/pt.css";
import { usePublicOverview } from "./public-api";

// Нүүр хуудас (D-84): хэрэглэгчийн pi_too_home.html загварын дизайн, өнгө, хөдөлгөөнийг дагана.
// Дараалал: hero, 3D карусель (зураг, багц, хөтөлбөрийн төрлүүд), хөтөлбөр, багш нар, сэтгэгдэл, 3 алхам, эцсийн дуудлага.
// Тоонууд (суудал, цаг, чөлөө, хувь, салбарын тоо) журмын тохиргоо, өгөгдлийн сангаас (ФШ-78, ФБШ-29).
// "Бидний тухай", "Салбарууд" нь цэсний "Манай төв"-өөс нээгдэнэ.
export function HomePage() {
  const overview = usePublicOverview().data;
  return (
    <div className="pt-ui overflow-x-clip bg-paper text-ink-900">
      <Hero />
      <ArcCarousel overview={overview} />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <ProgramsSection />
        <TeachersSection />
        <ReviewsSection />
        <StepsSection />
        <FinalCta overview={overview} />
      </div>
    </div>
  );
}
