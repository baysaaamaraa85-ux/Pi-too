import * as React from "react";
import { Link, createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { ComingSoonPage } from "@/features/admin/coming-soon-page";
import { LoginPage } from "@/features/auth/login-page";
import { ChangePasswordPage, ForgotPasswordPage, ResetPasswordPage } from "@/features/auth/password-pages";
import { HomePage } from "@/features/public/home-page";
import { PublicLayout } from "@/features/public/public-layout";
import { AdminShell } from "./admin-shell";
import { AppShell } from "./app-shell";
import { RequireAuth } from "./guards";

// ФБШ-04: хуудас бүр өөрийн файлаар (code splitting), нэвтрэх, нүүр хуудас шууд ачаалагдана.
const { lazy, Suspense } = React;
const AdminCatalogPage = lazy(() => import("@/features/admin/catalog-page").then((m) => ({ default: m.AdminCatalogPage })));
const AdminDashboardPage = lazy(() => import("@/features/admin/dashboard-page").then((m) => ({ default: m.AdminDashboardPage })));
const EnrollWizardPage = lazy(() => import("@/features/enroll/enroll-wizard").then((m) => ({ default: m.EnrollWizardPage })));
const AdminRequestsPage = lazy(() => import("@/features/admin/requests-page").then((m) => ({ default: m.AdminRequestsPage })));
const AdminAttendancePage = lazy(() => import("@/features/attendance/admin-attendance-page").then((m) => ({ default: m.AdminAttendancePage })));
const AttendancePage = lazy(() => import("@/features/attendance/attendance-page").then((m) => ({ default: m.AttendancePage })));
const AdminPayrollPage = lazy(() => import("@/features/payroll/admin-payroll-page").then((m) => ({ default: m.AdminPayrollPage })));
const TeacherSalaryPage = lazy(() => import("@/features/payroll/teacher-salary-page").then((m) => ({ default: m.TeacherSalaryPage })));
const AdminPaymentsPage = lazy(() => import("@/features/payments/admin-payments-page").then((m) => ({ default: m.AdminPaymentsPage })));
const AdminAuditPage = lazy(() => import("@/features/audit/audit-page").then((m) => ({ default: m.AdminAuditPage })));
const AdminReportsPage = lazy(() => import("@/features/reports/reports-page").then((m) => ({ default: m.AdminReportsPage })));
const AdminNotificationsPage = lazy(() => import("@/features/notifications/admin-notifications-page").then((m) => ({ default: m.AdminNotificationsPage })));
const PortalNotificationSettingsPage = lazy(() => import("@/features/notifications/portal-settings-page").then((m) => ({ default: m.PortalNotificationSettingsPage })));
const AdminSetupPage = lazy(() => import("@/features/admin/setup-page").then((m) => ({ default: m.AdminSetupPage })));
const AdminParentDetailPage = lazy(() => import("@/features/admin/parents-pages").then((m) => ({ default: m.AdminParentDetailPage })));
const AdminParentsPage = lazy(() => import("@/features/admin/parents-pages").then((m) => ({ default: m.AdminParentsPage })));
const AdminStudentDetailPage = lazy(() => import("@/features/admin/students-pages").then((m) => ({ default: m.AdminStudentDetailPage })));
const AdminStudentsPage = lazy(() => import("@/features/admin/students-pages").then((m) => ({ default: m.AdminStudentsPage })));
const AdminTeacherDetailPage = lazy(() => import("@/features/admin/teachers-pages").then((m) => ({ default: m.AdminTeacherDetailPage })));
const AdminTeachersPage = lazy(() => import("@/features/admin/teachers-pages").then((m) => ({ default: m.AdminTeachersPage })));
const ContactPage = lazy(() => import("@/features/public/contact-page").then((m) => ({ default: m.ContactPage })));
const ProgramsPage = lazy(() => import("@/features/public/programs-page").then((m) => ({ default: m.ProgramsPage })));
const TeachersPage = lazy(() => import("@/features/public/teachers-page").then((m) => ({ default: m.TeachersPage })));
const PortalAttendancePage = lazy(() => import("@/features/portal/portal-pages").then((m) => ({ default: m.PortalAttendancePage })));
const PortalHomePage = lazy(() => import("@/features/portal/portal-pages").then((m) => ({ default: m.PortalHomePage })));
const PortalPaymentPage = lazy(() => import("@/features/portal/portal-pages").then((m) => ({ default: m.PortalPaymentPage })));
const PortalSchedulePage = lazy(() => import("@/features/portal/portal-pages").then((m) => ({ default: m.PortalSchedulePage })));
const TeacherSchedulePage = lazy(() => import("@/features/schedule/schedule-page").then((m) => ({ default: m.TeacherSchedulePage })));
const TeacherClassesPage = lazy(() => import("@/features/teacher/classes-page").then((m) => ({ default: m.TeacherClassesPage })));
const TeacherStudentDetailPage = lazy(() => import("@/features/teacher/student-detail-page").then((m) => ({ default: m.TeacherStudentDetailPage })));
const TeacherStudentsPage = lazy(() => import("@/features/teacher/students-page").then((m) => ({ default: m.TeacherStudentsPage })));
const TeacherTodayPage = lazy(() => import("@/features/teacher/today-page").then((m) => ({ default: m.TeacherTodayPage })));

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
          { path: "/teacher/students/:studentId", element: <TeacherStudentDetailPage /> },
          { path: "/teacher/attendance/:lessonId", element: <AttendancePage /> },
          { path: "/teacher/salary", element: <TeacherSalaryPage /> },
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
          { path: "/admin/attendance", element: <AdminAttendancePage /> },
          { path: "/admin/attendance/:lessonId", element: <AttendancePage /> },
          { path: "/admin/payroll", element: <AdminPayrollPage /> },
          { path: "/admin/payments", element: <AdminPaymentsPage /> },
          { path: "/admin/notifications", element: <AdminNotificationsPage /> },
          { path: "/admin/reports", element: <AdminReportsPage /> },
          { path: "/admin/audit", element: <AdminAuditPage /> },
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
        children: [
          { path: "/portal/payment", element: <PortalPaymentPage /> },
          { path: "/portal/settings", element: <PortalNotificationSettingsPage /> },
        ],
      },
    ],
  },
  { path: "/home", element: <Navigate to="/" replace /> },
  { path: "*", element: <NotFound /> },
]);

export function AppRouter() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Ачаалж байна...</p>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
