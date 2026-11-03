import { z } from "zod";
import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { handle, ok, parseBody } from "@/lib/http";
import { withTransaction } from "@/lib/tx";
import { requireStudent } from "@/lib/me";
import { MAX_INTERESTS } from "@/lib/config";

// GET /api/me/interests  (Student)
export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireStudent();
        const interests = await rows(
            db,
            `SELECT i.Interest_ID, i.Interest_Name
             FROM PARTICIPANT_INTEREST pi
             JOIN INTERESTS i ON i.Interest_ID = pi.Interest_ID
             WHERE pi.Participant_ID = ?
             ORDER BY i.Interest_Name`,
            [session.participantId]
        );
        return ok({ interests });
    });
}

const putSchema = z.object({
    interestIds: z
        .array(z.coerce.number().int().positive())
        .max(MAX_INTERESTS, { message: `Pick at most ${MAX_INTERESTS} interests` }),
});

// PUT /api/me/interests  (Student)   Body: { interestIds: [1, 6, 8] }
// Replaces my interests in ONE transaction: DELETE the old rows, INSERT the
// new ones; an unknown Interest_ID makes the foreign key fail and the whole
// change is rolled back. The next recommendation request re-embeds my
// interest profile for the vector search.
export async function PUT(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireStudent();
        const { interestIds } = await parseBody(req, putSchema);
        const unique = [...new Set(interestIds)];

        await withTransaction(async (conn) => {
            await exec(conn, "DELETE FROM PARTICIPANT_INTEREST WHERE Participant_ID = ?", [session.participantId]);
            if (unique.length > 0) {
                await exec(conn, "INSERT INTO PARTICIPANT_INTEREST (Participant_ID, Interest_ID) VALUES ?", [
                    unique.map((id) => [session.participantId, id]),
                ]);
            }
        });

        return ok({ interestIds: unique });
    });
}
