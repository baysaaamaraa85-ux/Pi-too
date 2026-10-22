import type { Role } from "@pitoo/contracts";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { homeForRole } from "@/features/auth/home-for-role";

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-background" role="status">
      <span className="size-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
      <span className="sr-only">Ачаалж байна</span>
    </div>
  );
}

// ФБШ-20: интерфэйсийн хамгаалалт нь зөвхөн тохилог зориулалттай, бодит эрхийн
// шалгалт сервер дээр хийгддэг.
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // ФШ-03: түр нууц үгтэй хэрэглэгч нууц үгээ солихоос өмнө өөр хуудас руу шилжихгүй.
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }
  return <Outlet />;
}
