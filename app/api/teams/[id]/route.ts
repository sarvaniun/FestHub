
import { db } from "@/lib/db";
import { one, rows, exec } from "@/lib/sql";
import {
    handle,
    ok,
    HttpError,
    parseId,
    parseBody,
} from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { updateTeamSchema } from "@/lib/team-validators";

type TeamRow = {
    Team_ID: number;
    Team_Name: string;
    Event_ID: number;
    Event_Name: string;
};

type MemberRow = {
    Participant_ID: number;
    Name: string;
    Department: string | null;
};

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _req: Request,
    context: RouteContext
): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student participant profile not found");
        }

        const { id } = await context.params;
        const teamId = parseId(id, "team ID");

        const team = await one<TeamRow>(
            db,
            `SELECT
                t.Team_ID,
                t.Team_Name,
                t.Event_ID,
                e.Event_Name
            FROM TEAM t
            JOIN EVENT e ON e.Event_ID = t.Event_ID
            JOIN TEAM_MEMBER tm ON tm.Team_ID = t.Team_ID
            WHERE t.Team_ID = ?
              AND tm.Participant_ID = ?`,
            [teamId, session.participantId]
        );

        if (!team) {
            throw new HttpError(404, "Team not found");
        }

        const members = await rows<MemberRow>(
            db,
            `SELECT
                p.Participant_ID,
                p.Name,
                p.Department
            FROM TEAM_MEMBER tm
            JOIN PARTICIPANT p
                ON p.Participant_ID = tm.Participant_ID
            WHERE tm.Team_ID = ?
            ORDER BY p.Name`,
            [teamId]
        );

        return ok({
            team: {
                teamId: team.Team_ID,
                teamName: team.Team_Name,
                eventId: team.Event_ID,
                eventName: team.Event_Name,
                memberCount: members.length,
                members: members.map((member) => ({
                    participantId: member.Participant_ID,
                    name: member.Name,
                    department: member.Department,
                })),
            },
        });
    });
}

export async function PUT(
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
        const body = await parseBody(req, updateTeamSchema);

        const membership = await one<{ Team_ID: number }>(
            db,
            `SELECT Team_ID
             FROM TEAM_MEMBER
             WHERE Team_ID = ? AND Participant_ID = ?`,
            [teamId, session.participantId]
        );

        if (!membership) {
            throw new HttpError(404, "Team not found");
        }

        await exec(
            db,
            `UPDATE TEAM
             SET Team_Name = ?
             WHERE Team_ID = ?`,
            [body.teamName, teamId]
        );

        return ok({
            message: "Team updated successfully",
            team: {
                teamId,
                teamName: body.teamName,
            },
        });
    });
}

export async function DELETE(
    _req: Request,
    context: RouteContext
): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student participant profile not found");
        }

        const { id } = await context.params;
        const teamId = parseId(id, "team ID");

        // 1. Verify that the team exists.
        const team = await one<{ Team_ID: number }>(
            db,
            `SELECT Team_ID
             FROM TEAM
             WHERE Team_ID = ?`,
            [teamId]
        );

        if (!team) {
            throw new HttpError(404, "Team not found");
        }

        // 2. Verify that the student belongs to the team.
        const membership = await one<{ Team_ID: number }>(
            db,
            `SELECT Team_ID
             FROM TEAM_MEMBER
             WHERE Team_ID = ? AND Participant_ID = ?`,
            [teamId, session.participantId]
        );

        if (!membership) {
            throw new HttpError(403, "You are not a member of this team");
        }

        // 3. Preserve registration history.
        // Even cancelled registrations prevent team deletion.
        const registration = await one<{ Yes: number }>(
            db,
            `SELECT 1 AS Yes
             FROM REGISTRATION
             WHERE Team_ID = ?
             LIMIT 1`,
            [teamId]
        );

        if (registration) {
            throw new HttpError(
                409,
                "This team has been registered for the event, so it can't be deleted. Cancel the registration instead."
            );
        }

        // 4. Delete the team. TEAM_MEMBER rows are removed by ON DELETE CASCADE.
        await exec(
            db,
            `DELETE FROM TEAM
             WHERE Team_ID = ?`,
            [teamId]
        );

        return ok({ deleted: true });
    });
}
