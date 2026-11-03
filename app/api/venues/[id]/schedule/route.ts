import { db } from "@/lib/db";
import { rows, one } from "@/lib/sql";
import { handle, ok, parseId, HttpError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

// GET /api/venues/[id]/schedule  (public)
// The venue's events in time order. Uses the (Venue_ID, Start_Time) index.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const venueId = parseId((await params).id, "venue id");

        const venue = await one(
            db,
            "SELECT Venue_ID, Venue_Name, Capacity, Location FROM VENUE WHERE Venue_ID = ?",
            [venueId]
        );
        if (!venue) {
            throw new HttpError(404, "Venue not found");
        }

        const events = await rows(
            db,
            `SELECT Event_ID, Event_Name, Event_Type, Start_Time, End_Time
             FROM EVENT
             WHERE Venue_ID = ?
             ORDER BY Start_Time`,
            [venueId]
        );

        return ok({ venue, events });
    });
}
