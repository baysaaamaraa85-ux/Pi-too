import type { Role } from "@pitoo/contracts";

// Нэвтэрсний дараа үүрэг бүр өөрийн хэсэгт орно (design 5.5.1).
export function homeForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    default:
      return "/portal";
  }
}
