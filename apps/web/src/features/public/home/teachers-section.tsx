import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { TEACHERS } from "../content";
import { toCardData, usePublicTeachers } from "../public-api";
import { TeacherCard } from "../teacher-card";
import { SectionHead } from "./section-head";

// ФШ-78: нийтийн сайтын багш нар өгөгдлийн сангаас (багш өөрөө зураг, заах чиглэлээ оруулна). Идэвхтэй багш DB-д огт байхгүй
// (шинэ систем) үед л маркетингийн жишээ. Карт нь хэрэглэгчийн баталсан загвар (TeacherCard), бичвэр нь өмнөх хэвээр.
export function TeachersSection() {
  const teachers = usePublicTeachers();
  const cards = teachers.data && teachers.data.length > 0 ? teachers.data.map(toCardData) : teachers.isSuccess ? TEACHERS : [];
  return (
    <section id="teachers" className="mt-20 scroll-mt-24 sm:mt-28">
      <SectionHead
        eyebrow="Багш нар"
        title={
          <>
            Манай <span className="text-brand-700">багш нар</span>
          </>
        }
        text="Олон жилийн туршлагатай, бэлтгэгдсэн багш нартай танилцана уу"
        action={
          <Link to="/teachers" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-brand-700 hover:text-brand-800">
            Бүгдийг харах <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      <ul
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
        data-testid="home-teachers"
        aria-label="Багш нар"
      >
        {cards.map((t, i) => (
          <TeacherCard key={`${t.name}-${i}`} teacher={t} to="/teachers" className="snap-start" />
        ))}
      </ul>
    </section>
  );
}
