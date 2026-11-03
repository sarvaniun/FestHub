import { withTransaction } from "@/lib/tx";
import { one, exec } from "@/lib/sql";
import {
    handle,
    ok,
    HttpError,
    parseId,
} from "@/lib/http";
import { requireRole } from "@/lib/auth";

type RouteContext = {
    params: Promise<{ id: string; pid: string }>;
};

export async function DELETE(
    _req: Request,
    context: RouteContext
): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student participant profile not found");
        }

        const { id, pid } = await context.params;
        const teamId = parseId(id, "team ID");
        const participantId = parseId(pid, "participant ID");

        await withTransaction(async (conn) => {
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

            const requesterMembership = await one<{ Team_ID: number }>(
                conn,
                `SELECT Team_ID
                 FROM TEAM_MEMBER
                 WHERE Team_ID = ? AND Participant_ID = ?`,
                [teamId, session.participantId]
            );

            if (!requesterMembership) {
                throw new HttpError(
                    403,
                    "You are not a member of this team"
                );
            }

            const targetMembership = await one<{ Team_ID: number }>(
                conn,
                `SELECT Team_ID
                 FROM TEAM_MEMBER
                 WHERE Team_ID = ? AND Participant_ID = ?`,
                [teamId, participantId]
            );

            if (!targetMembership) {
                throw new HttpError(
                    404,
                    "Participant is not a member of this team"
                );
            }

            await exec(
                conn,
                `DELETE FROM TEAM_MEMBER
                 WHERE Team_ID = ? AND Participant_ID = ?`,
                [teamId, participantId]
            );
        });

        return ok({
            message: "Participant removed from team successfully",
            teamId,
            participantId,
        });
    });
}