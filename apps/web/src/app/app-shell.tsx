import { useAuth } from "@/features/auth/auth-context";
import { PortalShell } from "./portal-shell";
import { TeacherShell } from "./teacher-shell";

// Багш, эцэг эх, сурагчийн бүрхүүл: үүргээр нь сонгоно. Багш (teacher-shell.tsx, D-87), эцэг эх, сурагч (portal-shell.tsx, D-89).
export function AppShell() {
  const { user } = useAuth();
  if (!user || user.role === "ADMIN") return null;
  return user.role === "TEACHER" ? <TeacherShell /> : <PortalShell />;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative z-10 mb-5 flex flex-wrap items-end justify-between gap-3 md:pt-2">
      <div className="min-w-0">
        <h1 className="mb-1 font-display text-[clamp(1.7rem,2.6vw,2.4rem)] font-black leading-tight text-foreground-strong">
          {title}
        </h1>
        {subtitle ? <p className="text-sm text-mid">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
