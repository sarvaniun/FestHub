import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/organizers  (public: names and clubs only)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);

        const organizers = await rows(
            db,
            `SELECT o.Organizer_ID, o.Name, o.Club
             FROM EVENT_ORGANIZER eo
             JOIN ORGANIZER o ON o.Organizer_ID = eo.Organizer_ID
             WHERE eo.Event_ID = ?
             ORDER BY o.Name`,
            [eventId]
        );

        return ok({ organizers });
    });
}
