import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { handle, ok, parseBody } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { venueSchema } from "@/lib/people-validators";

// GET /api/venues  (public)  — with how many events each venue hosts
export async function GET(): Promise<Response> {
    return handle(async () => {
        const venues = await rows(
            db,
            `SELECT v.Venue_ID, v.Venue_Name, v.Capacity, v.Location,
                    COUNT(e.Event_ID) AS Events
             FROM VENUE v
             LEFT JOIN EVENT e ON e.Venue_ID = v.Venue_ID
             GROUP BY v.Venue_ID, v.Venue_Name, v.Capacity, v.Location
             ORDER BY v.Venue_Name`
        );
        return ok({ venues });
    });
}

// POST /api/venues  (Admin)   Body: { name, capacity, location? }
// CHECK (Capacity > 0) is enforced by MySQL as well as by zod.
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const input = await parseBody(req, venueSchema);

        const result = await exec(
            db,
            "INSERT INTO VENUE (Venue_Name, Capacity, Location) VALUES (?, ?, ?)",
            [input.name, input.capacity, input.location ?? null]
        );

        return ok({ venue: { Venue_ID: result.insertId } }, 201);
    });
}
