import { db } from "@/lib/db";
import { rows, one } from "@/lib/sql";
import { handle, ok, parseId, HttpError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

// GET /api/events/[id]/leaderboard  (public)
// Reads the V_LEADERBOARD view (sql/10_v_leaderboard.sql).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const eventId = parseId((await params).id, "event id");

        const event = await one<{ Event_ID: number; Event_Name: string }>(
            db,
            "SELECT Event_ID, Event_Name FROM EVENT WHERE Event_ID = ?",
            [eventId]
        );
        if (!event) {
            throw new HttpError(404, "Event not found");
        }

        const leaderboard = await rows<{
            Registration_ID: number;
            Registered_By: string;
            Average_Score: string;
            Judges: number;
            Leaderboard_Rank: number;
        }>(
            db,
            `SELECT Registration_ID, Registered_By, Average_Score, Judges, Leaderboard_Rank
             FROM V_LEADERBOARD
             WHERE Event_ID = ?
             ORDER BY Leaderboard_Rank, Registered_By`,
            [eventId]
        );

        return ok({
            event,
            leaderboard: leaderboard.map((r) => ({ ...r, Average_Score: Number(r.Average_Score) })),
        });
    });
}
