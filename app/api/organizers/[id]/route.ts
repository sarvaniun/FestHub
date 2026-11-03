import { db } from "@/lib/db";
import { one, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { organizerUpdateSchema, buildSet } from "@/lib/people-validators";

type Params = { params: Promise<{ id: string }> };

// GET /api/organizers/[id]  (Admin or Organizer)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN", "ORGANIZER");
        const organizerId = parseId((await params).id, "organizer id");
        const organizer = await one(
            db,
            "SELECT Organizer_ID, Name, Club, Email, Phone FROM ORGANIZER WHERE Organizer_ID = ?",
            [organizerId]
        );
        if (!organizer) {
            throw new HttpError(404, "Organizer not found");
        }
        return ok({ organizer });
    });
}

// PUT /api/organizers/[id]  (Admin)
export async function PUT(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const organizerId = parseId((await params).id, "organizer id");
        const input = await parseBody(req, organizerUpdateSchema);
        const set = buildSet(input, { name: "Name", club: "Club", phone: "Phone", email: "Email" });
        const result = await exec(
            db,
            `UPDATE ORGANIZER SET ${set.sql} WHERE Organizer_ID = ?`,
            [...set.values, organizerId]
        );
        if (result.affectedRows === 0) {
            throw new HttpError(404, "Organizer not found");
        }
        return ok({ organizer: { Organizer_ID: organizerId } });
    });
}

// DELETE /api/organizers/[id]  (Admin)
// EVENT_ORGANIZER rows go with it (CASCADE). If a login account is linked
// to this organizer, USER_ACCOUNT's RESTRICT foreign key blocks the delete.
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const organizerId = parseId((await params).id, "organizer id");
        try {
            const result = await exec(db, "DELETE FROM ORGANIZER WHERE Organizer_ID = ?", [organizerId]);
            if (result.affectedRows === 0) {
                throw new HttpError(404, "Organizer not found");
            }
        } catch (error) {
            if ((error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
                throw new HttpError(409, "This organizer has a login account. Remove the account first.");
            }
            throw error;
        }
        return ok({ deleted: true });
    });
}
