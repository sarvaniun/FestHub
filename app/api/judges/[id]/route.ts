import { db } from "@/lib/db";
import { one, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { judgeUpdateSchema, buildSet } from "@/lib/people-validators";

type Params = { params: Promise<{ id: string }> };

// GET /api/judges/[id]  (Admin or Organizer)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN", "ORGANIZER");
        const judgeId = parseId((await params).id, "judge id");
        const judge = await one(
            db,
            "SELECT Judge_ID, Name, Expertise, Email, Phone FROM JUDGE WHERE Judge_ID = ?",
            [judgeId]
        );
        if (!judge) {
            throw new HttpError(404, "Judge not found");
        }
        return ok({ judge });
    });
}

// PUT /api/judges/[id]  (Admin)
export async function PUT(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const judgeId = parseId((await params).id, "judge id");
        const input = await parseBody(req, judgeUpdateSchema);
        const set = buildSet(input, { name: "Name", expertise: "Expertise", phone: "Phone", email: "Email" });
        const result = await exec(
            db,
            `UPDATE JUDGE SET ${set.sql} WHERE Judge_ID = ?`,
            [...set.values, judgeId]
        );
        if (result.affectedRows === 0) {
            throw new HttpError(404, "Judge not found");
        }
        return ok({ judge: { Judge_ID: judgeId } });
    });
}

// DELETE /api/judges/[id]  (Admin)
// EVENT_JUDGE rows cascade, but SCORE references EVENT_JUDGE with RESTRICT,
// so a judge who has already scored cannot be deleted.
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const judgeId = parseId((await params).id, "judge id");
        try {
            const result = await exec(db, "DELETE FROM JUDGE WHERE Judge_ID = ?", [judgeId]);
            if (result.affectedRows === 0) {
                throw new HttpError(404, "Judge not found");
            }
        } catch (error) {
            if ((error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
                throw new HttpError(409, "This judge has already given scores, so they cannot be deleted.");
            }
            throw error;
        }
        return ok({ deleted: true });
    });
}
