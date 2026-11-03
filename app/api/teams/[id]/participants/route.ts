import { withTransaction } from "@/lib/tx";
import { one, exec } from "@/lib/sql";
import {
    handle,
    ok,
    HttpError,
    parseId,
    parseBody,
} from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { addTeamMemberSchema } from "@/lib/team-validators";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function POST(
    req: Request,
    context: RouteContext
): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student participant profile not found");
        }

        const { id } = await context.params;
        const teamId = parseId(id, "team ID");
        const body = await parseBody(req, addTeamMemberSchema);

        await withTransaction(async (conn) => {
            // Lock the team row while checking and adding a member.
            const team = await one<{ Team_ID: number }>(
                conn,
                `SELECT Team_ID
                 FROM TEAM
                 WHERE Team_ID = ?
                 FOR UPDATE`,
                [teamId]
            );

            if (!team) {
                throw new HttpError(404, "Team not found");
            }

            // Only an existing team member can add another participant.
            const membership = await one<{ Team_ID: number }>(
                conn,
                `SELECT Team_ID
                 FROM TEAM_MEMBER
                 WHERE Team_ID = ? AND Participant_ID = ?`,
                [teamId, session.participantId]
            );

            if (!membership) {
                throw new HttpError(
                    403,
                    "You are not a member of this team"
                );
            }

            // Verify that the participant being added exists.
            const participant = await one<{ Participant_ID: number }>(
                conn,
                `SELECT Participant_ID
                 FROM PARTICIPANT
                 WHERE Participant_ID = ?`,
                [body.participantId]
            );

            if (!participant) {
                throw new HttpError(404, "Participant not found");
            }

            await exec(
                conn,
                `INSERT INTO TEAM_MEMBER (Team_ID, Participant_ID)
                 VALUES (?, ?)`,
                [teamId, body.participantId]
            );
        });

        return ok(
            {
                message: "Participant added to team successfully",
                teamId,
                participantId: body.participantId,
            },
            201
        );
    });
}