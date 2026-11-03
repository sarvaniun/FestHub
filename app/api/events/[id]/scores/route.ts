import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent, assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/scores  (Admin, or an Organizer of this event)
// Every score already given for this event, for the score-entry page.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);
        await assertCanManageEvent(session, eventId);

        const scores = await rows(
            db,
            `SELECT s.Judge_ID, j.Name AS Judge, s.Registration_ID,
                    COALESCE(p.Name, t.Team_Name) AS Registered_By,
                    s.Score, s.Remarks, s.Scored_At
             FROM SCORE s
             JOIN JUDGE j        ON j.Judge_ID = s.Judge_ID
             JOIN REGISTRATION r ON r.Registration_ID = s.Registration_ID
             LEFT JOIN PARTICIPANT p ON p.Participant_ID = r.Participant_ID
             LEFT JOIN TEAM t        ON t.Team_ID = r.Team_ID
             WHERE s.Event_ID = ?
             ORDER BY Registered_By, j.Name`,
            [eventId]
        );

        return ok({ scores });
    });
}
