import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/judges  (public: names and expertise only)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);

        const judges = await rows(
            db,
            `SELECT j.Judge_ID, j.Name, j.Expertise
             FROM EVENT_JUDGE ej
             JOIN JUDGE j ON j.Judge_ID = ej.Judge_ID
             WHERE ej.Event_ID = ?
             ORDER BY j.Name`,
            [eventId]
        );

        return ok({ judges });
    });
}
