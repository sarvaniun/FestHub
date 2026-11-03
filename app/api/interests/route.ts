import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";

// GET /api/interests  (public) — every interest, for pickers
export async function GET(): Promise<Response> {
    return handle(async () => {
        const interests = await rows(
            db,
            "SELECT Interest_ID, Interest_Name FROM INTERESTS ORDER BY Interest_Name"
        );
        return ok({ interests });
    });
}
