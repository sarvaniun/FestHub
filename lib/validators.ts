import {z} from "zod";

export const emailSchema = z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .transform((email) => email.toLowerCase());
export const passwordSchema = z.string().min(8, {message: "Password must be at least 8 characters long"}).max(72, {message: "Password must be at most 72 characters long"});
export const usernameSchema = z.string().regex(/^[A-Za-z0-9_-]{3,20}$/, {
  message: "Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens.",
});
export const signupSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    username: usernameSchema,
    name: z.string().trim().min(2, {
      message: "Name must be at least 2 characters long"
    }).max(100, {
      message: "Name must be at most 100 characters long"
    }),
});

export type SignupInput=z.infer<typeof signupSchema>;

export const loginSchema = z.object({
    identifier: z.string().trim().min(1, {
        message: "Email or username is required",
    }),
    password: z.string().min(1, {
        message: "Password is required",
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    department: z.string().trim().max(100).nullable().optional(),
}).refine(
    (data) =>
        data.name !== undefined ||
        data.phone !== undefined ||
        data.department !== undefined,
    { message: "Provide at least one field to update" }
);

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
