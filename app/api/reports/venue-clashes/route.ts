import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";
import { requireRole } from "@/lib/auth";

// GET /api/reports/venue-clashes  (Admin)
// Stage 2 Q7: SELF-JOIN of EVENT on the same venue with overlapping slots.
// e1.Event_ID < e2.Event_ID lists each pair once. The trigger in
// sql/09 stops NEW clashes; this report finds any that already exist.
export async function GET(): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const clashes = await rows(
            db,
            `SELECT v.Venue_Name,
                    e1.Event_ID AS Event_A_ID, e1.Event_Name AS Event_A,
                    e2.Event_ID AS Event_B_ID, e2.Event_Name AS Event_B,
                    GREATEST(e1.Start_Time, e2.Start_Time) AS Overlap_From,
                    LEAST(e1.End_Time, e2.End_Time)        AS Overlap_To
             FROM EVENT e1
             JOIN EVENT e2
               ON e1.Venue_ID   = e2.Venue_ID
              AND e1.Event_ID   < e2.Event_ID
              AND e1.Start_Time < e2.End_Time
              AND e2.Start_Time < e1.End_Time
             JOIN VENUE v ON v.Venue_ID = e1.Venue_ID
             ORDER BY Overlap_From`
        );
        return ok({ clashes });
    });
}
