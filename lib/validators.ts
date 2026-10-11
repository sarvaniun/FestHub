import {z} from "zod";

export const emailSchema = z.string().email({message: "Invalid email address"});
export const passwordSchema = z.string().min(8, {message: "Password must be at least 8 characters long"}).max(72, {message: "Password must be at most 72 characters long"});
export const usernameSchema = z.string().regex(/^[A-Za-z0-9_-]{3,20}$/, {
  message: "Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens.",
});
export const signupSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    username: usernameSchema
});
export type SignupInput=z.infer<typeof signupSchema>;