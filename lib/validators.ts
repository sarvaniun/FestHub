import {z} from "zod";

export const emailSchema = z.string().email({message: "Invalid email address"});
export const passwordSchema = z.string().min(8, {message: "Password must be at least 8 characters long"}).max(72, {message: "Password must be at most 72 characters long"});