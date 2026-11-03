import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";
import { requireStudent } from "@/lib/me";
import { JOINED_EVENTS_SQL } from "@/lib/recommend";

// GET /api/me/events  (Student)
// The events I'm taking part in (alone or with a team), not cancelled.
export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireStudent();
        const pid = session.participantId;

        const events = await rows(
            db,
            `SELECT e.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time, e.End_Time, v.Venue_Name
             FROM EVENT e
             JOIN VENUE v ON v.Venue_ID = e.Venue_ID
             WHERE e.Event_ID IN (${JOINED_EVENTS_SQL})
             ORDER BY e.Start_Time`,
            [pid, pid]
        );

        return ok({ events });
    });
}
