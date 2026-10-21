import { z } from "zod";

// ФШ-01: утас эсвэл имэйлээр нэвтэрнэ. Аль нь болохыг backend тодорхойлно.
export const loginSchema = z.object({
  identifier: z.string().min(1, "Утас эсвэл имэйл шаардлагатай"),
  password: z.string().min(1, "Нууц үг шаардлагатай"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ФБШ-18: 8-аас доош тэмдэгттэй нууц үг хүлээн авахгүй.
export const passwordSchema = z.string().min(8, "Нууц үг 8-оос доошгүй тэмдэгттэй байх ёстой");

// ФШ-03: түр нууц үгээр нэвтэрсэн хэрэглэгч шинэ нууц үг тохируулна.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Одоогийн нууц үг шаардлагатай"),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Зөв имэйл хаяг оруулна уу"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token шаардлагатай"),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ФШ-02, 03: админ багш, эцэг эхийн данс түр нууц үгтэй үүсгэнэ.
export const createUserSchema = z.object({
  role: z.enum(["TEACHER", "PARENT"]),
  phone: z.string().min(1, "Утас дугаар шаардлагатай"),
  fullName: z.string().min(1, "Нэр шаардлагатай"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// ФШ-06: админ дансыг идэвхгүй болгоно.
export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
