import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { handle, ok, parseBody } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { organizerSchema } from "@/lib/people-validators";

// GET /api/organizers  (Admin or Organizer) — with the number of events each runs
export async function GET(): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN", "ORGANIZER");
        const organizers = await rows(
            db,
            `SELECT o.Organizer_ID, o.Name, o.Club, o.Email, o.Phone,
                    COUNT(eo.Event_ID) AS Events
             FROM ORGANIZER o
             LEFT JOIN EVENT_ORGANIZER eo ON eo.Organizer_ID = o.Organizer_ID
             GROUP BY o.Organizer_ID, o.Name, o.Club, o.Email, o.Phone
             ORDER BY o.Name`
        );
        return ok({ organizers });
    });
}

// POST /api/organizers  (Admin)  Body: { name, email, phone?, club? }
// A duplicate email is rejected by UNIQUE (uq_organizer_email) → 409.
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const input = await parseBody(req, organizerSchema);
        const result = await exec(
            db,
            "INSERT INTO ORGANIZER (Name, Club, Phone, Email) VALUES (?, ?, ?, ?)",
            [input.name, input.club ?? null, input.phone ?? null, input.email]
        );
        return ok({ organizer: { Organizer_ID: result.insertId } }, 201);
    });
}
