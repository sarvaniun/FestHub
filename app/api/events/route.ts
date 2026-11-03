import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseQuery } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/tx";
import {
    EVENT_LIST_COLUMNS,
    withSeats,
    type EventListRow,
} from "@/lib/event-queries";
import { createEventSchema, eventFiltersSchema } from "@/lib/event-validators";

// GET /api/events?type=Team&date=2026-10-11&venue=2&q=hack
// Anyone can list events. All filters are optional.
export async function GET(req: Request): Promise<Response> {
    return handle(async () => {
        const filters = parseQuery(req, eventFiltersSchema);

        const where: string[] = [];
        const params: unknown[] = [];

        if (filters.type) {
            where.push("e.Event_Type = ?");
            params.push(filters.type);
        }
        if (filters.date) {
            // events running on that day (starts before the day ends and
            // ends after the day starts)
            where.push("e.Start_Time < DATE_ADD(?, INTERVAL 1 DAY) AND e.End_Time > ?");
            params.push(filters.date, filters.date);
        }
        if (filters.venue) {
            where.push("e.Venue_ID = ?");
            params.push(filters.venue);
        }
        if (filters.q) {
            where.push("(e.Event_Name LIKE ? OR e.Description LIKE ?)");
            params.push(`%${filters.q}%`, `%${filters.q}%`);
        }

        const events = await rows<EventListRow>(
            db,
            `SELECT ${EVENT_LIST_COLUMNS}
             FROM EVENT e
             JOIN VENUE v ON v.Venue_ID = e.Venue_ID
             ${where.length ? "WHERE " + where.join(" AND ") : ""}
             ORDER BY e.Start_Time ASC`,
            params
        );

        return ok({ events: events.map(withSeats) });
    });
}

// POST /api/events  (Admin or Organizer)
// Body: { name, description?, startTime, endTime, budget, eventType, venueId }
// An organizer who creates an event is automatically linked to it.
// The venue double-booking trigger (sql/09) can reject the insert; the
// error handler turns its SIGNAL message into a 400 response.
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const input = await parseBody(req, createEventSchema);

        const eventId = await withTransaction(async (conn) => {
            const result = await exec(
                conn,
                `INSERT INTO EVENT
                    (Event_Name, Description, Start_Time, End_Time, Budget, Event_Type, Venue_ID)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    input.name,
                    input.description ?? null,
                    input.startTime,
                    input.endTime,
                    input.budget,
                    input.eventType,
                    input.venueId,
                ]
            );

            if (session.role === "ORGANIZER" && session.organizerId !== null) {
                await exec(
                    conn,
                    "INSERT INTO EVENT_ORGANIZER (Event_ID, Organizer_ID) VALUES (?, ?)",
                    [result.insertId, session.organizerId]
                );
            }

            return result.insertId;
        });

        return ok({ event: { Event_ID: eventId } }, 201);
    });
}
