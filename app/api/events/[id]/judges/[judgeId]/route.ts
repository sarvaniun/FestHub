import { db } from "@/lib/db";
import { exec } from "@/lib/sql";
import { handle, ok, parseId, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string; judgeId: string }> };

// POST /api/events/[id]/judges/[judgeId]  (Admin) — assign
export async function POST(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const p = await params;
        const eventId = parseId(p.id, "event id");
        const judgeId = parseId(p.judgeId, "judge id");
        await exec(
            db,
            "INSERT INTO EVENT_JUDGE (Event_ID, Judge_ID) VALUES (?, ?)",
            [eventId, judgeId]
        );
        return ok({ assigned: true }, 201);
    });
}

// DELETE /api/events/[id]/judges/[judgeId]  (Admin) — remove
// SCORE references EVENT_JUDGE with RESTRICT: once a judge has scored
// this event, MySQL refuses to un-assign them.
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const p = await params;
        const eventId = parseId(p.id, "event id");
        const judgeId = parseId(p.judgeId, "judge id");
        try {
            const result = await exec(
                db,
                "DELETE FROM EVENT_JUDGE WHERE Event_ID = ? AND Judge_ID = ?",
                [eventId, judgeId]
            );
            if (result.affectedRows === 0) {
                throw new HttpError(404, "This judge is not assigned to this event");
            }
        } catch (error) {
            if ((error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
                throw new HttpError(
                    409,
                    "This judge has already scored this event, so they cannot be removed (foreign key RESTRICT)."
                );
            }
            throw error;
        }
        return ok({ removed: true });
    });
}
