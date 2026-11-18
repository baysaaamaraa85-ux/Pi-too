import type { LucideIcon } from "lucide-react";

// Харанхуй дээрх гэрэлтдэг шилэн дүрсний хавтан (bento, хөтөлбөр, алхмын картад нэг хэв маяг). Hover үед томорч, бага зэрэг эргэнэ.
export function IconTile({ icon: Icon, hue }: { icon: LucideIcon; hue: string }) {
  return (
    <span
      className="relative grid size-16 place-items-center rounded-[20px] text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
      style={{
        background: "linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.04))",
        border: "1px solid rgba(255,255,255,.22)",
        boxShadow: `0 0 40px rgba(${hue},.55),inset 0 1px 0 rgba(255,255,255,.3)`,
      }}
      aria-hidden="true"
    >
      <Icon className="size-7" />
    </span>
  );
}
