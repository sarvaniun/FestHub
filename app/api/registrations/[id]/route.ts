import { z } from "zod";
import { db } from "@/lib/db";
import { one, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId, HttpError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/permissions";
import { getRegistration, isOwnRegistration } from "@/lib/registrations";

type Params = { params: Promise<{ id: string }> };

// GET /api/registrations/[id]
// Admin, an organizer of the event, or the student it belongs to.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireSession();
        const id = parseId((await params).id, "registration id");
        const reg = await getRegistration(id);

        if (session.role === "STUDENT") {
            if (!(await isOwnRegistration(session, reg))) {
                throw new HttpError(403, "This is not your registration");
            }
        } else {
            await assertCanManageEvent(session, reg.Event_ID);
        }

        const registration = await one(
            db,
            `SELECT r.Registration_ID, r.Event_ID, e.Event_Name, e.Event_Type,
                    r.Participant_ID, r.Team_ID, COALESCE(p.Name, t.Team_Name) AS Registered_By,
                    r.Status, r.Registration_Time
             FROM REGISTRATION r
             JOIN EVENT e            ON e.Event_ID = r.Event_ID
             LEFT JOIN PARTICIPANT p ON p.Participant_ID = r.Participant_ID
             LEFT JOIN TEAM t        ON t.Team_ID = r.Team_ID
             WHERE r.Registration_ID = ?`,
            [id]
        );
        return ok({ registration });
    });
}

const statusSchema = z.object({
    status: z.enum(["Pending", "Confirmed", "Cancelled"]),
});

// PUT /api/registrations/[id]   Body: { status: "Confirmed" | "Cancelled" | "Pending" }
// Admin, or an organizer of the event (confirm / cancel registrations).
// CHECK (Status IN ('Pending','Confirmed','Cancelled')) guards it in MySQL too.
export async function PUT(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const id = parseId((await params).id, "registration id");
        const reg = await getRegistration(id);
        await assertCanManageEvent(session, reg.Event_ID);
        const { status } = await parseBody(req, statusSchema);

        await exec(db, "UPDATE REGISTRATION SET Status = ? WHERE Registration_ID = ?", [status, id]);
        return ok({ registration: { Registration_ID: id, Status: status } });
    });
}

// DELETE /api/registrations/[id]  (Student cancels their own)
// A soft delete: CALL sp_cancel_registration sets Status = 'Cancelled' and
// keeps the row, so history (and any scores) stay intact.
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");
        const id = parseId((await params).id, "registration id");
        const reg = await getRegistration(id);

        if (!(await isOwnRegistration(session, reg))) {
            throw new HttpError(403, "This is not your registration");
        }

        await db.query("CALL sp_cancel_registration(?)", [id]);
        return ok({ registration: { Registration_ID: id, Status: "Cancelled" } });
    });
}
