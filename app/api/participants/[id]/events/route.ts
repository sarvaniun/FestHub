import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireSession } from "@/lib/auth";
import { assertCanViewParticipant, assertParticipantExists } from "@/lib/participant-access";
import { JOINED_EVENTS_SQL } from "@/lib/recommend";

type Params = { params: Promise<{ id: string }> };

// GET /api/participants/[id]/events — events they take part in (alone or via a team)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireSession();
        const id = parseId((await params).id, "participant id");
        assertCanViewParticipant(session, id);
        await assertParticipantExists(id);

        const events = await rows(
            db,
            `SELECT e.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time, e.End_Time
             FROM EVENT e
             WHERE e.Event_ID IN (${JOINED_EVENTS_SQL})
             ORDER BY e.Start_Time`,
            [id, id]
        );
        return ok({ events });
    });
}
