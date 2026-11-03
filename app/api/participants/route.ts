import { z } from "zod";
import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { handle, ok, parseBody } from "@/lib/http";
import { requireRole } from "@/lib/auth";

// GET /api/participants?q=rahul&department=CSE  (Admin or Organizer)
// Uses the idx_participant_department index when filtering by department.
export async function GET(req: Request): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN", "ORGANIZER");
        const url = new URL(req.url);
        const q = url.searchParams.get("q")?.trim();
        const department = url.searchParams.get("department")?.trim();

        const where: string[] = [];
        const params: unknown[] = [];
        if (q) {
            where.push("(p.Name LIKE ? OR p.Email LIKE ?)");
            params.push(`%${q}%`, `%${q}%`);
        }
        if (department) {
            where.push("p.Department = ?");
            params.push(department);
        }

        const participants = await rows(
            db,
            `SELECT p.Participant_ID, p.Name, p.Email, p.Phone, p.Department,
                    (SELECT COUNT(*) FROM REGISTRATION r
                      WHERE r.Participant_ID = p.Participant_ID AND r.Status <> 'Cancelled') AS Individual_Registrations,
                    (SELECT COUNT(*) FROM TEAM_MEMBER tm WHERE tm.Participant_ID = p.Participant_ID) AS Teams
             FROM PARTICIPANT p
             ${where.length ? "WHERE " + where.join(" AND ") : ""}
             ORDER BY p.Name`,
            params
        );
        return ok({ participants });
    });
}

const createSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().toLowerCase(),
    phone: z.string().trim().max(20).nullable().optional(),
    department: z.string().trim().max(100).nullable().optional(),
});

// POST /api/participants  (Admin)  — adds a participant without a login.
// UNIQUE (Email) rejects a duplicate email → 409.
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const input = await parseBody(req, createSchema);
        const result = await exec(
            db,
            "INSERT INTO PARTICIPANT (Name, Email, Phone, Department) VALUES (?, ?, ?, ?)",
            [input.name, input.email, input.phone || null, input.department || null]
        );
        return ok({ participant: { Participant_ID: result.insertId } }, 201);
    });
}
