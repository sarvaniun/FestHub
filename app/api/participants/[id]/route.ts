import { z } from "zod";
import { db } from "@/lib/db";
import { one, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId, HttpError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/auth";
import { assertCanViewParticipant } from "@/lib/participant-access";

type Params = { params: Promise<{ id: string }> };

// GET /api/participants/[id]  (Admin, Organizer, or the student themselves)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireSession();
        const id = parseId((await params).id, "participant id");
        assertCanViewParticipant(session, id);

        const participant = await one(
            db,
            "SELECT Participant_ID, Name, Email, Phone, Department FROM PARTICIPANT WHERE Participant_ID = ?",
            [id]
        );
        if (!participant) {
            throw new HttpError(404, "Participant not found");
        }
        return ok({ participant });
    });
}

const updateSchema = z
    .object({
        name: z.string().trim().min(2).max(100).optional(),
        phone: z.string().trim().max(20).nullable().optional(),
        department: z.string().trim().max(100).nullable().optional(),
    })
    .refine((v) => Object.values(v).some((x) => x !== undefined), {
        message: "Provide at least one field to update",
    });

// PUT /api/participants/[id]  (the student themselves, or Admin)
// Email is not editable here: it is the login identity.
export async function PUT(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireSession();
        const id = parseId((await params).id, "participant id");
        if (session.role === "ORGANIZER" || (session.role === "STUDENT" && session.participantId !== id)) {
            throw new HttpError(403, "You can only edit your own profile");
        }
        const input = await parseBody(req, updateSchema);

        const sets: string[] = [];
        const values: unknown[] = [];
        if (input.name !== undefined) { sets.push("Name = ?"); values.push(input.name); }
        if (input.phone !== undefined) { sets.push("Phone = ?"); values.push(input.phone || null); }
        if (input.department !== undefined) { sets.push("Department = ?"); values.push(input.department || null); }

        const result = await exec(
            db,
            `UPDATE PARTICIPANT SET ${sets.join(", ")} WHERE Participant_ID = ?`,
            [...values, id]
        );
        if (result.affectedRows === 0) {
            throw new HttpError(404, "Participant not found");
        }
        return ok({ participant: { Participant_ID: id } });
    });
}

// DELETE /api/participants/[id]  (Admin)
// TEAM_MEMBER and PARTICIPANT_INTEREST rows cascade. REGISTRATION and
// USER_ACCOUNT use RESTRICT, so a participant who has registrations or a
// login cannot be deleted (409) — their history must not silently vanish.
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const id = parseId((await params).id, "participant id");
        try {
            const result = await exec(db, "DELETE FROM PARTICIPANT WHERE Participant_ID = ?", [id]);
            if (result.affectedRows === 0) {
                throw new HttpError(404, "Participant not found");
            }
        } catch (error) {
            if ((error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
                throw new HttpError(409, "This participant has registrations or a login account, so they cannot be deleted");
            }
            throw error;
        }
        return ok({ deleted: true });
    });
}
