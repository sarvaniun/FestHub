import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent, assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/registrations  (Admin, or an Organizer of this event)
// One row per registration; Registered_By is the student's name or the
// team's name (exactly one of them is set, enforced by a CHECK).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);
        await assertCanManageEvent(session, eventId);

        const registrations = await rows(
            db,
            `SELECT r.Registration_ID, r.Event_ID, r.Participant_ID, r.Team_ID,
                    COALESCE(p.Name, t.Team_Name) AS Registered_By,
                    CASE WHEN r.Team_ID IS NULL THEN 'Individual' ELSE 'Team' END AS Kind,
                    r.Status, r.Registration_Time
             FROM REGISTRATION r
             LEFT JOIN PARTICIPANT p ON p.Participant_ID = r.Participant_ID
             LEFT JOIN TEAM t        ON t.Team_ID = r.Team_ID
             WHERE r.Event_ID = ?
             ORDER BY r.Registration_Time`,
            [eventId]
        );

        return ok({ registrations });
    });
}
