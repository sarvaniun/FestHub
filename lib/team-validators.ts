
import { z } from "zod";

// Create a new team for an event
export const createTeamSchema = z.object({
    teamName: z
        .string()
        .trim()
        .min(2, { message: "Team name must be at least 2 characters long" })
        .max(100, { message: "Team name must be at most 100 characters long" }),

    eventId: z
        .number()
        .int()
        .positive({ message: "Invalid event ID" }),
});

// Update an existing team's name
export const updateTeamSchema = z.object({
    teamName: z
        .string()
        .trim()
        .min(2, { message: "Team name must be at least 2 characters long" })
        .max(100, { message: "Team name must be at most 100 characters long" }),
});

// Add a participant to a team
export const addTeamMemberSchema = z.object({
    participantId: z
        .number()
        .int()
        .positive({ message: "Invalid participant ID" }),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
