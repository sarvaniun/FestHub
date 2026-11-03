import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireSession } from "@/lib/auth";
import { assertCanViewParticipant, assertParticipantExists } from "@/lib/participant-access";

type Params = { params: Promise<{ id: string }> };

// GET /api/participants/[id]/teams
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireSession();
        const id = parseId((await params).id, "participant id");
        assertCanViewParticipant(session, id);
        await assertParticipantExists(id);

        const teams = await rows(
            db,
            `SELECT t.Team_ID, t.Team_Name, t.Event_ID, e.Event_Name
             FROM TEAM_MEMBER tm
             JOIN TEAM t  ON t.Team_ID = tm.Team_ID
             JOIN EVENT e ON e.Event_ID = t.Event_ID
             WHERE tm.Participant_ID = ?
             ORDER BY e.Start_Time`,
            [id]
        );
        return ok({ teams });
    });
}
