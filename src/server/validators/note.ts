import { z } from "zod";

export const createNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must not exceed 200 characters"),

  content: z
    .string()
    .min(1, "Content is required")
    .max(10_000, "Content must not exceed 10,000 characters")
    .refine(
      (value) => value.trim().length > 0,
      "Content cannot contain only whitespace",
    ),

  expiresAt: z
    .string()
    .datetime({ offset: true })
    .refine(
      (value) => new Date(value).getTime() > Date.now(),
      "Expiry must be in the future",
    ),

  shareType: z.enum(["ONE_TIME", "TIME_BASED"]),

  accessType: z.enum(["PUBLIC", "PASSWORD"]),
});

export const noteIdSchema = z.object({
  id: z.string().uuid("Invalid note ID"),
});
