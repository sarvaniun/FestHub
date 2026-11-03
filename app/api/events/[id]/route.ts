import { db } from "@/lib/db";
import { rows, one, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/permissions";
import {
    EVENT_LIST_COLUMNS,
    withSeats,
    type EventListRow,
} from "@/lib/event-queries";
import { updateEventSchema } from "@/lib/event-validators";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]
// Event + venue + seats left + organizers + judges + interest tags.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const eventId = parseId((await params).id, "event id");

        const event = await one<EventListRow>(
            db,
            `SELECT ${EVENT_LIST_COLUMNS}
             FROM EVENT e
             JOIN VENUE v ON v.Venue_ID = e.Venue_ID
             WHERE e.Event_ID = ?`,
            [eventId]
        );

        if (!event) {
            throw new HttpError(404, "Event not found");
        }

        const organizers = await rows<{ Organizer_ID: number; Name: string; Club: string | null }>(
            db,
            `SELECT o.Organizer_ID, o.Name, o.Club
             FROM EVENT_ORGANIZER eo
             JOIN ORGANIZER o ON o.Organizer_ID = eo.Organizer_ID
             WHERE eo.Event_ID = ?
             ORDER BY o.Name`,
            [eventId]
        );

        const judges = await rows<{ Judge_ID: number; Name: string; Expertise: string | null }>(
            db,
            `SELECT j.Judge_ID, j.Name, j.Expertise
             FROM EVENT_JUDGE ej
             JOIN JUDGE j ON j.Judge_ID = ej.Judge_ID
             WHERE ej.Event_ID = ?
             ORDER BY j.Name`,
            [eventId]
        );

        const tags = await rows<{ Interest_ID: number; Interest_Name: string }>(
            db,
            `SELECT i.Interest_ID, i.Interest_Name
             FROM EVENT_INTEREST ei
             JOIN INTERESTS i ON i.Interest_ID = ei.Interest_ID
             WHERE ei.Event_ID = ?
             ORDER BY i.Interest_Name`,
            [eventId]
        );

        return ok({ event: { ...withSeats(event), organizers, judges, tags } });
    });
}

// PUT /api/events/[id]  (Admin, or an Organizer of this event)
// Send only the fields you want to change.
export async function PUT(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertCanManageEvent(session, eventId);
        const input = await parseBody(req, updateEventSchema);

        const columns: Record<string, string> = {
            name: "Event_Name",
            description: "Description",
            startTime: "Start_Time",
            endTime: "End_Time",
            budget: "Budget",
            eventType: "Event_Type",
            venueId: "Venue_ID",
        };

        const sets: string[] = [];
        const values: unknown[] = [];
        for (const [key, column] of Object.entries(columns)) {
            const value = input[key as keyof typeof input];
            if (value !== undefined) {
                sets.push(`${column} = ?`);
                values.push(value);
            }
        }

        // The CHECK (End_Time > Start_Time) and the venue trigger are
        // checked by MySQL on this UPDATE.
        const result = await exec(
            db,
            `UPDATE EVENT SET ${sets.join(", ")} WHERE Event_ID = ?`,
            [...values, eventId]
        );

        if (result.affectedRows === 0) {
            throw new HttpError(404, "Event not found");
        }

        return ok({ event: { Event_ID: eventId } });
    });
}

// DELETE /api/events/[id]  (Admin only)
// Registrations, organizer/judge links, tags and expenses are removed by
// ON DELETE CASCADE. Teams use RESTRICT, so an event that still has teams
// (or judges who already scored) cannot be deleted: MySQL refuses and
// the error handler returns 409.
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const eventId = parseId((await params).id, "event id");

        const result = await exec(db, "DELETE FROM EVENT WHERE Event_ID = ?", [eventId]);

        if (result.affectedRows === 0) {
            throw new HttpError(404, "Event not found");
        }

        return ok({ deleted: true });
    });
}
