import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok, parseId } from "@/lib/http";
import { requireSession } from "@/lib/auth";
import { assertCanViewParticipant, assertParticipantExists } from "@/lib/participant-access";

type Params = { params: Promise<{ id: string }> };

// GET /api/participants/[id]/registrations — individual + team registrations
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireSession();
        const id = parseId((await params).id, "participant id");
        assertCanViewParticipant(session, id);
        await assertParticipantExists(id);

        const registrations = await rows(
            db,
            `SELECT r.Registration_ID, r.Event_ID, e.Event_Name, 'Individual' AS Joined_As,
                    NULL AS Team_Name, r.Status, r.Registration_Time
             FROM REGISTRATION r JOIN EVENT e ON e.Event_ID = r.Event_ID
             WHERE r.Participant_ID = ?
             UNION ALL
             SELECT r.Registration_ID, r.Event_ID, e.Event_Name, 'Team' AS Joined_As,
                    t.Team_Name, r.Status, r.Registration_Time
             FROM REGISTRATION r
             JOIN TEAM t         ON t.Team_ID = r.Team_ID
             JOIN TEAM_MEMBER tm ON tm.Team_ID = t.Team_ID
             JOIN EVENT e        ON e.Event_ID = r.Event_ID
             WHERE tm.Participant_ID = ?
             ORDER BY Registration_Time`,
            [id, id]
        );
        return ok({ registrations });
    });
}
