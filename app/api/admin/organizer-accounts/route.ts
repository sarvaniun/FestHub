import { z } from "zod";
import { db } from "@/lib/db";
import { rows, one, exec } from "@/lib/sql";
import { handle, ok, parseBody, HttpError } from "@/lib/http";
import { requireRole, hashPassword } from "@/lib/auth";
import { withTransaction } from "@/lib/tx";
import { emailSchema, passwordSchema, usernameSchema } from "@/lib/validators";

// GET /api/admin/organizer-accounts  (Admin) — organizers and their logins
export async function GET(): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const organizers = await rows(
            db,
            `SELECT o.Organizer_ID, o.Name, o.Club, o.Email,
                    u.User_ID, u.Username, u.Is_Active
             FROM ORGANIZER o
             LEFT JOIN USER_ACCOUNT u ON u.Organizer_ID = o.Organizer_ID
             ORDER BY o.Name`
        );
        return ok({ organizers });
    });
}

const createSchema = z.object({
    // either link an existing ORGANIZER row...
    organizerId: z.coerce.number().int().positive().optional(),
    // ...or create a new one
    name: z.string().trim().min(2).max(100).optional(),
    club: z.string().trim().max(100).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
});

// POST /api/admin/organizer-accounts  (Admin)
// Creates (or reuses) the ORGANIZER row and its ORGANIZER login in ONE
// transaction, so we never end up with half an account. Public sign-up can
// only ever create STUDENT accounts; this is the only way to get an
// ORGANIZER login. chk_user_role_link guarantees an ORGANIZER account has
// an Organizer_ID and no Participant_ID.
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const input = await parseBody(req, createSchema);
        if (!input.organizerId && !input.name) {
            throw new HttpError(400, "Give either an existing organizer or a name for a new one");
        }
        const passwordHash = await hashPassword(input.password);

        const account = await withTransaction(async (conn) => {
            let organizerId = input.organizerId;

            if (organizerId) {
                const existing = await one(conn, "SELECT Organizer_ID FROM ORGANIZER WHERE Organizer_ID = ?", [organizerId]);
                if (!existing) {
                    throw new HttpError(404, "Organizer not found");
                }
            } else {
                const created = await exec(
                    conn,
                    "INSERT INTO ORGANIZER (Name, Club, Phone, Email) VALUES (?, ?, ?, ?)",
                    [input.name, input.club || null, input.phone || null, input.email]
                );
                organizerId = created.insertId;
            }

            const user = await exec(
                conn,
                `INSERT INTO USER_ACCOUNT (Email, Username, Password_Hash, Role, Participant_ID, Organizer_ID)
                 VALUES (?, ?, ?, 'ORGANIZER', NULL, ?)`,
                [input.email, input.username, passwordHash, organizerId]
            );

            return { userId: user.insertId, organizerId, username: input.username };
        });

        return ok({ account }, 201);
    });
}
