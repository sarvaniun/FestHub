import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent, assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/missing-scores  (Admin, or an Organizer of this event)
// Stage 2 Q16b: every (assigned judge × confirmed registration) pair that
// has no SCORE row yet. LEFT JOIN SCORE ... WHERE s.Registration_ID IS NULL
// is an anti-join: it keeps exactly the pairs with no matching score.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);
        await assertCanManageEvent(session, eventId);

        const missing = await rows(
            db,
            `SELECT j.Judge_ID, j.Name AS Judge, r.Registration_ID,
                    COALESCE(p.Name, t.Team_Name) AS Registered_By
             FROM EVENT_JUDGE ej
             JOIN JUDGE j        ON j.Judge_ID = ej.Judge_ID
             JOIN REGISTRATION r ON r.Event_ID = ej.Event_ID AND r.Status = 'Confirmed'
             LEFT JOIN SCORE s   ON s.Judge_ID = ej.Judge_ID AND s.Registration_ID = r.Registration_ID
             LEFT JOIN PARTICIPANT p ON p.Participant_ID = r.Participant_ID
             LEFT JOIN TEAM t        ON t.Team_ID = r.Team_ID
             WHERE ej.Event_ID = ?
               AND s.Registration_ID IS NULL
             ORDER BY j.Name, Registered_By`,
            [eventId]
        );

        return ok({ missing });
    });
}
