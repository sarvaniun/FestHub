import { db } from "@/lib/db";
import { exec } from "@/lib/sql";
import { handle, ok, parseId, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string; organizerId: string }> };

// POST /api/events/[id]/organizers/[organizerId]  (Admin) — assign
// The composite primary key (Event_ID, Organizer_ID) stops double
// assignment (409); the foreign keys reject unknown ids (400).
export async function POST(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const p = await params;
        const eventId = parseId(p.id, "event id");
        const organizerId = parseId(p.organizerId, "organizer id");
        await exec(
            db,
            "INSERT INTO EVENT_ORGANIZER (Event_ID, Organizer_ID) VALUES (?, ?)",
            [eventId, organizerId]
        );
        return ok({ assigned: true }, 201);
    });
}

// DELETE /api/events/[id]/organizers/[organizerId]  (Admin) — remove
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const p = await params;
        const eventId = parseId(p.id, "event id");
        const organizerId = parseId(p.organizerId, "organizer id");
        const result = await exec(
            db,
            "DELETE FROM EVENT_ORGANIZER WHERE Event_ID = ? AND Organizer_ID = ?",
            [eventId, organizerId]
        );
        if (result.affectedRows === 0) {
            throw new HttpError(404, "This organizer is not assigned to this event");
        }
        return ok({ removed: true });
    });
}
