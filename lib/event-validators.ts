import { z } from "zod";

// Accepts "2026-10-11T09:00", "2026-10-11T09:00:00" or "2026-10-11 09:00"
// and turns it into MySQL DATETIME text "2026-10-11 09:00:00".
// We keep it as text (not a JS Date) so no time-zone shifting happens.
export const dateTimeSchema = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, {
        message: "Date-time must look like 2026-10-11T09:00",
    })
    .transform((value) => {
        const text = value.replace("T", " ");
        return text.length === 16 ? `${text}:00` : text;
    });

const eventFields = {
    name: z.string().trim().min(2, { message: "Event name is too short" }).max(100),
    description: z.string().trim().max(500).nullable().optional(),
    startTime: dateTimeSchema,
    endTime: dateTimeSchema,
    budget: z.coerce.number().min(0, { message: "Budget cannot be negative" }),
    eventType: z.enum(["Individual", "Team"]),
    venueId: z.coerce.number().int().positive(),
};

export const createEventSchema = z
    .object(eventFields)
    .refine((e) => e.endTime > e.startTime, {
        message: "End time must be after start time",
    });

// For PUT every field is optional, but at least one must be sent.
export const updateEventSchema = z
    .object({
        name: eventFields.name.optional(),
        description: eventFields.description,
        startTime: eventFields.startTime.optional(),
        endTime: eventFields.endTime.optional(),
        budget: eventFields.budget.optional(),
        eventType: eventFields.eventType.optional(),
        venueId: eventFields.venueId.optional(),
    })
    .refine((e) => Object.values(e).some((v) => v !== undefined), {
        message: "Provide at least one field to update",
    })
    .refine((e) => !e.startTime || !e.endTime || e.endTime > e.startTime, {
        message: "End time must be after start time",
    });

export const eventFiltersSchema = z.object({
    type: z.enum(["Individual", "Team"]).optional(),
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" })
        .optional(),
    venue: z.coerce.number().int().positive().optional(),
    q: z.string().trim().max(100).optional(),
    mine: z.enum(["0", "1"]).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
