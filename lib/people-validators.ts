import { z } from "zod";

const optionalText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .nullable()
        .optional()
        .transform((v) => (v === "" ? null : v));

export const venueSchema = z.object({
    name: z.string().trim().min(2, { message: "Venue name is too short" }).max(100),
    capacity: z.coerce.number().int().positive({ message: "Capacity must be more than 0" }),
    location: optionalText(100),
});

export const organizerSchema = z.object({
    name: z.string().trim().min(2, { message: "Name is too short" }).max(100),
    email: z.string().trim().email({ message: "Invalid email address" }).toLowerCase(),
    phone: optionalText(20),
    club: optionalText(100),
});

export const judgeSchema = z.object({
    name: z.string().trim().min(2, { message: "Name is too short" }).max(100),
    email: z.string().trim().email({ message: "Invalid email address" }).toLowerCase(),
    phone: optionalText(20),
    expertise: optionalText(200),
});

// For PUT: same fields, all optional, at least one required.
function partial<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
    return schema
        .partial()
        .refine((v) => Object.values(v).some((x) => x !== undefined), {
            message: "Provide at least one field to update",
        });
}

export const venueUpdateSchema = partial(venueSchema);
export const organizerUpdateSchema = partial(organizerSchema);
export const judgeUpdateSchema = partial(judgeSchema);

// Builds "A = ?, B = ?" from only the fields that were sent.
export function buildSet(
    input: Record<string, unknown>,
    columns: Record<string, string>
): { sql: string; values: unknown[] } {
    const parts: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(columns)) {
        if (input[key] !== undefined) {
            parts.push(`${column} = ?`);
            values.push(input[key]);
        }
    }
    return { sql: parts.join(", "), values };
}
