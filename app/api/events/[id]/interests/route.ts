import { z } from "zod";
import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/tx";
import { assertCanManageEvent, assertEventExists } from "@/lib/permissions";
import { syncEventEmbedding } from "@/lib/vector";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/interests  (public)
// The event's tags, plus every interest (so the tagging page can show
// checkboxes without needing another route).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);

        const interests = await rows<{ Interest_ID: number; Interest_Name: string }>(
            db,
            `SELECT i.Interest_ID, i.Interest_Name
             FROM EVENT_INTEREST ei
             JOIN INTERESTS i ON i.Interest_ID = ei.Interest_ID
             WHERE ei.Event_ID = ?
             ORDER BY i.Interest_Name`,
            [eventId]
        );
        const allInterests = await rows<{ Interest_ID: number; Interest_Name: string }>(
            db,
            "SELECT Interest_ID, Interest_Name FROM INTERESTS ORDER BY Interest_Name"
        );

        return ok({ interests, allInterests });
    });
}

const putSchema = z.object({
    interestIds: z.array(z.coerce.number().int().positive()).max(20, { message: "At most 20 tags" }),
});

// PUT /api/events/[id]/interests  (Admin, or an Organizer of this event)
// Body: { interestIds: [1, 4, 7] } — replaces the event's tags.
// Done in a transaction so the event is never left half-tagged:
// DELETE the old rows, INSERT the new ones, COMMIT (or ROLLBACK on error,
// e.g. an unknown Interest_ID rejected by the foreign key).
export async function PUT(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);
        await assertCanManageEvent(session, eventId);
        const { interestIds } = await parseBody(req, putSchema);
        const unique = [...new Set(interestIds)];

        await withTransaction(async (conn) => {
            await exec(conn, "DELETE FROM EVENT_INTEREST WHERE Event_ID = ?", [eventId]);
            if (unique.length > 0) {
                // mysql2 expands [[a, b], [c, d]] into (a, b), (c, d)
                await exec(conn, "INSERT INTO EVENT_INTEREST (Event_ID, Interest_ID) VALUES ?", [
                    unique.map((interestId) => [eventId, interestId]),
                ]);
            }
        });

        // The tags are part of the embedded text, so re-embed the event.
        await syncEventEmbedding(eventId);

        return ok({ event: { Event_ID: eventId }, interestIds: unique });
    });
}
