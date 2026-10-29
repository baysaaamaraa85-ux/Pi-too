import { Link, createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AdminCatalogPage } from "@/features/admin/catalog-page";
import { AdminDashboardPage } from "@/features/admin/dashboard-page";
import { EnrollWizardPage } from "@/features/enroll/enroll-wizard";
import { AdminRequestsPage } from "@/features/admin/requests-page";
import { AdminSetupPage } from "@/features/admin/setup-page";
import { ComingSoonPage } from "@/features/admin/coming-soon-page";
import { AdminParentDetailPage, AdminParentsPage } from "@/features/admin/parents-pages";
import { AdminStudentDetailPage, AdminStudentsPage } from "@/features/admin/students-pages";
import { AdminTeacherDetailPage, AdminTeachersPage } from "@/features/admin/teachers-pages";
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
import {
  PortalAttendancePage,
  PortalHomePage,
  PortalPaymentPage,
  PortalSchedulePage,
} from "@/features/portal/portal-pages";
import { TeacherSchedulePage } from "@/features/schedule/schedule-page";
import { TeacherClassesPage } from "@/features/teacher/classes-page";
import { TeacherStudentsPage } from "@/features/teacher/students-page";
import { TeacherTodayPage } from "@/features/teacher/today-page";
import { AdminShell } from "./admin-shell";
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
          { path: "/teacher/students", element: <TeacherStudentsPage /> },
          { path: "/teacher/enroll", element: <EnrollWizardPage mode="teacher" /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth roles={["ADMIN"]} />,
    children: [
      {
        element: <AdminShell />,
        children: [
          { path: "/admin", element: <AdminDashboardPage /> },
          { path: "/admin/teachers", element: <AdminTeachersPage /> },
          { path: "/admin/teachers/:id", element: <AdminTeacherDetailPage /> },
          { path: "/admin/students", element: <AdminStudentsPage /> },
          { path: "/admin/students/:id", element: <AdminStudentDetailPage /> },
          { path: "/admin/parents", element: <AdminParentsPage /> },
          { path: "/admin/parents/:id", element: <AdminParentDetailPage /> },
          { path: "/admin/requests", element: <AdminRequestsPage /> },
          { path: "/admin/setup", element: <AdminSetupPage /> },
          { path: "/admin/enroll", element: <EnrollWizardPage mode="admin" /> },
          { path: "/admin/catalog", element: <AdminCatalogPage /> },
          {
            path: "/admin/classes",
            element: <ComingSoonPage title="Анги ба хуваарь" text="Админы анги, хуваарийн хэсэг дараагийн шатанд нэмэгдэнэ." />,
          },
          {
            path: "/admin/attendance",
            element: <ComingSoonPage title="Ирц" text="Ирцийн хэсэг дараагийн шатанд нэмэгдэнэ." />,
          },
          {
            path: "/admin/payroll",
            element: <ComingSoonPage title="Цалин" text="Цалингийн хэсэг дараагийн шатанд нэмэгдэнэ." />,
          },
          {
            path: "/admin/payments",
            element: <ComingSoonPage title="Төлбөр" text="Төлбөрийн хэсэг дараагийн шатанд нэмэгдэнэ." />,
          },
          {
            path: "/admin/notifications",
            element: <ComingSoonPage title="Мэдэгдэл" text="Мэдэгдлийн хэсэг дараагийн шатанд нэмэгдэнэ." />,
          },
          {
            path: "/admin/reports",
            element: <ComingSoonPage title="Тайлан" text="Тайлангийн хэсэг дараагийн шатанд нэмэгдэнэ." />,
          },
          {
            path: "/admin/audit",
            element: <ComingSoonPage title="Аудит" text="Аудитын бүртгэл дараагийн шатанд нэмэгдэнэ." />,
          },
        ],
      },
    ],
  },
  {
    element: <RequireAuth roles={["PARENT", "STUDENT"]} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/portal", element: <PortalHomePage /> },
          { path: "/portal/schedule", element: <PortalSchedulePage /> },
          { path: "/portal/attendance", element: <PortalAttendancePage /> },
        ],
      },
    ],
  },
  {
    // ФШ-66: төлбөрийн хуудас зөвхөн эцэг эхэд, сурагчид харагдахгүй.
    element: <RequireAuth roles={["PARENT"]} />,
    children: [
      {
        element: <AppShell />,
        children: [{ path: "/portal/payment", element: <PortalPaymentPage /> }],
      },
    ],
  },
  { path: "/home", element: <Navigate to="/" replace /> },
  { path: "*", element: <NotFound /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
