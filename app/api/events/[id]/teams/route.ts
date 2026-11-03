import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/teams  (public)
// Teams formed for this event, with member count and registration status.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);

        const teams = await rows<{
            Team_ID: number;
            Team_Name: string;
            Members: number;
            Member_Names: string | null;
            Registration_Status: string | null;
        }>(
            db,
            `SELECT t.Team_ID, t.Team_Name,
                    COUNT(tm.Participant_ID) AS Members,
                    GROUP_CONCAT(p.Name ORDER BY p.Name SEPARATOR ', ') AS Member_Names,
                    (SELECT r.Status FROM REGISTRATION r
                      WHERE r.Team_ID = t.Team_ID AND r.Event_ID = t.Event_ID
                      LIMIT 1) AS Registration_Status
             FROM TEAM t
             LEFT JOIN TEAM_MEMBER tm ON tm.Team_ID = t.Team_ID
             LEFT JOIN PARTICIPANT p  ON p.Participant_ID = tm.Participant_ID
             WHERE t.Event_ID = ?
             GROUP BY t.Team_ID, t.Team_Name
             ORDER BY t.Team_Name`,
            [eventId]
        );

        return ok({ teams });
    });
}
