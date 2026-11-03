import { z } from "zod";
import { db } from "@/lib/db";
import { one, exec } from "@/lib/sql";
import { handle, ok, parseBody, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/permissions";

const scoreSchema = z.object({
    registrationId: z.coerce.number().int().positive(),
    judgeId: z.coerce.number().int().positive(),
    score: z.coerce.number().min(0, { message: "Score must be 0–100" }).max(100, { message: "Score must be 0–100" }),
    remarks: z.string().trim().max(255).nullable().optional(),
});

// Finds the event of a registration (SCORE stores Event_ID too, so that
// the composite foreign keys can check judge and registration belong to
// the same event).
async function eventOfRegistration(registrationId: number): Promise<number> {
    const reg = await one<{ Event_ID: number; Status: string }>(
        db,
        "SELECT Event_ID, Status FROM REGISTRATION WHERE Registration_ID = ?",
        [registrationId]
    );
    if (!reg) {
        throw new HttpError(404, "Registration not found");
    }
    if (reg.Status === "Cancelled") {
        throw new HttpError(400, "This registration was cancelled, so it cannot be scored");
    }
    return reg.Event_ID;
}

// We deliberately do NOT check in code whether the judge is assigned to
// the event: the composite foreign key
//   SCORE(Event_ID, Judge_ID) → EVENT_JUDGE(Event_ID, Judge_ID)
// does it in the database. Here we only turn its error into a clear message.
function explainScoreError(error: unknown): never {
    const e = error as { code?: string; sqlMessage?: string };
    if (e.code === "ER_NO_REFERENCED_ROW_2" && e.sqlMessage?.includes("fk_score_event_judge")) {
        throw new HttpError(
            400,
            "This judge is not assigned to this event (rejected by foreign key fk_score_event_judge)"
        );
    }
    if (e.code === "ER_DUP_ENTRY") {
        throw new HttpError(409, "This judge has already scored this registration. Use edit to change it.");
    }
    throw error;
}

// POST /api/scores  (Admin, or an Organizer of the event)
// Body: { registrationId, judgeId, score, remarks? }
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const input = await parseBody(req, scoreSchema);
        const eventId = await eventOfRegistration(input.registrationId);
        await assertCanManageEvent(session, eventId);

        try {
            await exec(
                db,
                `INSERT INTO SCORE (Event_ID, Judge_ID, Registration_ID, Score, Remarks)
                 VALUES (?, ?, ?, ?, ?)`,
                [eventId, input.judgeId, input.registrationId, input.score, input.remarks ?? null]
            );
        } catch (error) {
            explainScoreError(error);
        }

        return ok({ score: { eventId, judgeId: input.judgeId, registrationId: input.registrationId } }, 201);
    });
}

// PUT /api/scores  (Admin, or an Organizer of the event)
// Same body; changes an existing score. (Judge_ID, Registration_ID) is
// the primary key of SCORE.
export async function PUT(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const input = await parseBody(req, scoreSchema);
        const eventId = await eventOfRegistration(input.registrationId);
        await assertCanManageEvent(session, eventId);

        const result = await exec(
            db,
            `UPDATE SCORE SET Score = ?, Remarks = ?, Scored_At = CURRENT_TIMESTAMP
             WHERE Judge_ID = ? AND Registration_ID = ?`,
            [input.score, input.remarks ?? null, input.judgeId, input.registrationId]
        );
        if (result.affectedRows === 0) {
            throw new HttpError(404, "No score from this judge for this registration yet");
        }

        return ok({ score: { eventId, judgeId: input.judgeId, registrationId: input.registrationId } });
    });
}
