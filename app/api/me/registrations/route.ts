import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";
import { requireStudent } from "@/lib/me";

// GET /api/me/registrations  (Student)
// My registrations: the ones I made myself UNION the ones of teams I'm in.
export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireStudent();
        const pid = session.participantId;

        const registrations = await rows(
            db,
            `SELECT r.Registration_ID, r.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time,
                    v.Venue_Name, 'Individual' AS Joined_As, NULL AS Team_ID, NULL AS Team_Name,
                    r.Status, r.Registration_Time
             FROM REGISTRATION r
             JOIN EVENT e ON e.Event_ID = r.Event_ID
             JOIN VENUE v ON v.Venue_ID = e.Venue_ID
             WHERE r.Participant_ID = ?
             UNION ALL
             SELECT r.Registration_ID, r.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time,
                    v.Venue_Name, 'Team' AS Joined_As, t.Team_ID, t.Team_Name,
                    r.Status, r.Registration_Time
             FROM REGISTRATION r
             JOIN TEAM t         ON t.Team_ID = r.Team_ID
             JOIN TEAM_MEMBER tm ON tm.Team_ID = t.Team_ID
             JOIN EVENT e        ON e.Event_ID = r.Event_ID
             JOIN VENUE v        ON v.Venue_ID = e.Venue_ID
             WHERE tm.Participant_ID = ?
             ORDER BY Start_Time`,
            [pid, pid]
        );

        return ok({ registrations });
    });
}
