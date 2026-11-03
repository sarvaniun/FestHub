import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";
import { requireRole } from "@/lib/auth";

// GET /api/reports/fill-rate  (Admin)
// Stage 2 Q6: seats taken vs venue capacity. An individual registration
// takes 1 seat, a team registration one seat per member (correlated
// subquery on TEAM_MEMBER). LEFT JOIN so events with no registrations
// show 0 instead of disappearing.
export async function GET(): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const fillRate = await rows(
            db,
            `SELECT e.Event_ID, e.Event_Name, v.Venue_Name, v.Capacity,
                    COALESCE(s.Seats_Taken, 0) AS Seats_Taken,
                    ROUND(100 * COALESCE(s.Seats_Taken, 0) / v.Capacity, 1) AS Fill_Percent,
                    CASE WHEN COALESCE(s.Seats_Taken, 0) >= v.Capacity       THEN 'Full'
                         WHEN COALESCE(s.Seats_Taken, 0) >= 0.8 * v.Capacity THEN 'Nearly full'
                         ELSE 'Seats available' END AS Seat_Status
             FROM EVENT e
             JOIN VENUE v ON v.Venue_ID = e.Venue_ID
             LEFT JOIN (
                    SELECT r.Event_ID,
                           SUM(CASE
                                 WHEN r.Participant_ID IS NOT NULL THEN 1
                                 ELSE (SELECT COUNT(*) FROM TEAM_MEMBER tm
                                       WHERE tm.Team_ID = r.Team_ID)
                               END) AS Seats_Taken
                    FROM REGISTRATION r
                    WHERE r.Status <> 'Cancelled'
                    GROUP BY r.Event_ID
                  ) s ON s.Event_ID = e.Event_ID
             ORDER BY Fill_Percent DESC`
        );
        return ok({ fillRate });
    });
}
