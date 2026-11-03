import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { handle, ok, parseBody } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { judgeSchema } from "@/lib/people-validators";

// GET /api/judges  (Admin or Organizer) — with the number of events each judges
export async function GET(): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN", "ORGANIZER");
        const judges = await rows(
            db,
            `SELECT j.Judge_ID, j.Name, j.Expertise, j.Email, j.Phone,
                    COUNT(ej.Event_ID) AS Events
             FROM JUDGE j
             LEFT JOIN EVENT_JUDGE ej ON ej.Judge_ID = j.Judge_ID
             GROUP BY j.Judge_ID, j.Name, j.Expertise, j.Email, j.Phone
             ORDER BY j.Name`
        );
        return ok({ judges });
    });
}

// POST /api/judges  (Admin)  Body: { name, email, phone?, expertise? }
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const input = await parseBody(req, judgeSchema);
        const result = await exec(
            db,
            "INSERT INTO JUDGE (Name, Email, Phone, Expertise) VALUES (?, ?, ?, ?)",
            [input.name, input.email, input.phone ?? null, input.expertise ?? null]
        );
        return ok({ judge: { Judge_ID: result.insertId } }, 201);
    });
}
