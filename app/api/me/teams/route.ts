import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";
import { requireStudent } from "@/lib/me";

// GET /api/me/teams            (Student) all teams I'm a member of
// GET /api/me/teams?eventId=2  only my teams formed for that event
export async function GET(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireStudent();
        const eventId = Number(new URL(req.url).searchParams.get("eventId") ?? 0);

        const teams = await rows(
            db,
            `SELECT t.Team_ID, t.Team_Name, t.Event_ID, e.Event_Name,
                    (SELECT COUNT(*) FROM TEAM_MEMBER x WHERE x.Team_ID = t.Team_ID) AS Members,
                    (SELECT GROUP_CONCAT(p.Name ORDER BY p.Name SEPARATOR ', ')
                       FROM TEAM_MEMBER x JOIN PARTICIPANT p ON p.Participant_ID = x.Participant_ID
                      WHERE x.Team_ID = t.Team_ID) AS Member_Names,
                    (SELECT r.Status FROM REGISTRATION r
                      WHERE r.Team_ID = t.Team_ID AND r.Event_ID = t.Event_ID LIMIT 1) AS Registration_Status
             FROM TEAM_MEMBER tm
             JOIN TEAM t  ON t.Team_ID = tm.Team_ID
             JOIN EVENT e ON e.Event_ID = t.Event_ID
             WHERE tm.Participant_ID = ?
               ${eventId > 0 ? "AND t.Event_ID = ?" : ""}
             ORDER BY e.Start_Time, t.Team_Name`,
            eventId > 0 ? [session.participantId, eventId] : [session.participantId]
        );

        return ok({ teams });
    });
}
