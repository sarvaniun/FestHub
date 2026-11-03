import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";
import { requireRole } from "@/lib/auth";

// GET /api/reports/readiness  (Admin)
// Reads the V_EVENT_READINESS view (sql/12_v_event_readiness.sql).
export async function GET(): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const readiness = await rows(
            db,
            `SELECT Event_ID, Event_Name, Start_Time, Organizers, Judges, Registrations, Readiness
             FROM V_EVENT_READINESS
             ORDER BY Readiness, Event_Name`
        );
        return ok({ readiness });
    });
}
