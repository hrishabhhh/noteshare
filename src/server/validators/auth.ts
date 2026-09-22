import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254, "Email is too long"),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(72, "Password is too long")
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      "Password must not exceed 72 bytes",
    ),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254),

  password: z
    .string()
    .min(1, "Password is required")
    .max(72)
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      "Password must not exceed 72 bytes",
    ),
});
