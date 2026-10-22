import { Link, createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AdminCatalogPage } from "@/features/admin/catalog-page";
import { AdminDashboardPage } from "@/features/admin/dashboard-page";
import { AdminEnrollPage } from "@/features/admin/enroll-page";
import { AdminRequestsPage } from "@/features/admin/requests-page";
import { AdminUsersPage } from "@/features/admin/users-page";
import { LoginPage } from "@/features/auth/login-page";
import {
  ChangePasswordPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from "@/features/auth/password-pages";
import { ContactPage } from "@/features/public/contact-page";
import { HomePage } from "@/features/public/home-page";
import { ProgramsPage } from "@/features/public/programs-page";
import { PublicLayout } from "@/features/public/public-layout";
import { TeachersPage } from "@/features/public/teachers-page";
import { PortalSchedulePage, TeacherSchedulePage } from "@/features/schedule/schedule-page";
import { TeacherClassesPage } from "@/features/teacher/classes-page";
import { TeacherTodayPage } from "@/features/teacher/today-page";
import { AppShell } from "./app-shell";
import { RequireAuth } from "./guards";

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-5 text-center">
      <div>
        <p className="font-display text-6xl font-black text-primary">404</p>
        <p className="mt-2 text-muted">Хуудас олдсонгүй.</p>
        <Link to="/" className="mt-5 inline-block font-semibold text-primary hover:underline">
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/programs", element: <ProgramsPage /> },
      { path: "/teachers", element: <TeachersPage /> },
      { path: "/contact", element: <ContactPage /> },
    ],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [{ path: "/change-password", element: <ChangePasswordPage /> }],
  },
  {
    element: <RequireAuth roles={["TEACHER"]} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/teacher", element: <TeacherTodayPage /> },
          { path: "/teacher/calendar", element: <TeacherSchedulePage /> },
          { path: "/teacher/classes", element: <TeacherClassesPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth roles={["ADMIN"]} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/admin", element: <AdminDashboardPage /> },
          { path: "/admin/requests", element: <AdminRequestsPage /> },
          { path: "/admin/enroll", element: <AdminEnrollPage /> },
          { path: "/admin/users", element: <AdminUsersPage /> },
          { path: "/admin/catalog", element: <AdminCatalogPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth roles={["PARENT", "STUDENT"]} />,
    children: [
      {
        element: <AppShell />,
        children: [{ path: "/portal", element: <PortalSchedulePage /> }],
      },
    ],
  },
  { path: "/home", element: <Navigate to="/" replace /> },
  { path: "*", element: <NotFound /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
