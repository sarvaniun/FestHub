import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent, assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/participants  (Admin, or an Organizer of this event)
// Everyone taking part: individual registrants UNION members of
// registered teams. Cancelled registrations are left out.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);
        await assertCanManageEvent(session, eventId);

        const participants = await rows(
            db,
            `SELECT p.Participant_ID, p.Name, p.Email, p.Department,
                    'Individual' AS Joined_As, NULL AS Team_Name, r.Status
             FROM REGISTRATION r
             JOIN PARTICIPANT p ON p.Participant_ID = r.Participant_ID
             WHERE r.Event_ID = ? AND r.Status <> 'Cancelled'
             UNION ALL
             SELECT p.Participant_ID, p.Name, p.Email, p.Department,
                    'Team' AS Joined_As, t.Team_Name, r.Status
             FROM REGISTRATION r
             JOIN TEAM t         ON t.Team_ID = r.Team_ID
             JOIN TEAM_MEMBER tm ON tm.Team_ID = t.Team_ID
             JOIN PARTICIPANT p  ON p.Participant_ID = tm.Participant_ID
             WHERE r.Event_ID = ? AND r.Status <> 'Cancelled'
             ORDER BY Name`,
            [eventId, eventId]
        );

        return ok({ participants });
    });
}
