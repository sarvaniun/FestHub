import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/organizers/[id]/events  (Admin or Organizer)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN", "ORGANIZER");
        const organizerId = parseId((await params).id, "organizer id");
        const events = await rows(
            db,
            `SELECT e.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time, e.End_Time, v.Venue_Name
             FROM EVENT_ORGANIZER eo
             JOIN EVENT e ON e.Event_ID = eo.Event_ID
             JOIN VENUE v ON v.Venue_ID = e.Venue_ID
             WHERE eo.Organizer_ID = ?
             ORDER BY e.Start_Time`,
            [organizerId]
        );
        return ok({ events });
    });
}
