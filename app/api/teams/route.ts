
import { db } from "@/lib/db";
import { rows, exec } from "@/lib/sql";
import { withTransaction } from "@/lib/tx";
import {
    handle,
    ok,
    HttpError,
    parseBody,
} from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { createTeamSchema } from "@/lib/team-validators";

type TeamRow = {
    Team_ID: number;
    Team_Name: string;
    Event_ID: number;
    Event_Name: string;
    Participant_ID: number;
    Participant_Name: string;
};

type EventRow = {
    Event_ID: number;
    Event_Type: "Individual" | "Team";
};

export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student participant profile not found");
        }

        const teamRows = await rows<TeamRow>(
            db,
            `SELECT
                t.Team_ID,
                t.Team_Name,
                t.Event_ID,
                e.Event_Name,
                p.Participant_ID,
                p.Name AS Participant_Name
            FROM TEAM t
            JOIN EVENT e ON e.Event_ID = t.Event_ID
            JOIN TEAM_MEMBER own_member ON own_member.Team_ID = t.Team_ID
            JOIN TEAM_MEMBER tm ON tm.Team_ID = t.Team_ID
            JOIN PARTICIPANT p ON p.Participant_ID = tm.Participant_ID
            WHERE own_member.Participant_ID = ?
            ORDER BY t.Team_ID, p.Name`,
            [session.participantId]
        );

        const teamMap = new Map<number, {
            teamId: number;
            teamName: string;
            eventId: number;
            eventName: string;
            memberCount: number;
            members: { participantId: number; name: string }[];
        }>();

        for (const row of teamRows) {
            if (!teamMap.has(row.Team_ID)) {
                teamMap.set(row.Team_ID, {
                    teamId: row.Team_ID,
                    teamName: row.Team_Name,
                    eventId: row.Event_ID,
                    eventName: row.Event_Name,
                    memberCount: 0,
                    members: [],
                });
            }

            const team = teamMap.get(row.Team_ID)!;

            team.members.push({
                participantId: row.Participant_ID,
                name: row.Participant_Name,
            });

            team.memberCount++;
        }

        return ok({ teams: Array.from(teamMap.values()) });
    });
}

export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student participant profile not found");
        }

        const body = await parseBody(req, createTeamSchema);

        const result = await withTransaction(async (conn) => {
            // Verify that the event exists and supports team participation.
            const event = await rows<EventRow>(
                conn,
                `SELECT Event_ID, Event_Type
                 FROM EVENT
                 WHERE Event_ID = ?
                 FOR UPDATE`,
                [body.eventId]
            );

            if (event.length === 0) {
                throw new HttpError(404, "Event not found");
            }

            if (event[0].Event_Type !== "Team") {
                throw new HttpError(
                    400,
                    "Teams can only be created for team events"
                );
            }

            // Create the team. MySQL generates Team_ID.
            const insertedTeam = await exec(
                conn,
                `INSERT INTO TEAM (Team_Name, Event_ID)
                 VALUES (?, ?)`,
                [body.teamName, body.eventId]
            );

            const teamId = insertedTeam.insertId;

            // Add the logged-in student as the first team member.
            await exec(
                conn,
                `INSERT INTO TEAM_MEMBER (Team_ID, Participant_ID)
                 VALUES (?, ?)`,
                [teamId, session.participantId]
            );

            return {
                teamId,
                teamName: body.teamName,
                eventId: body.eventId,
            };
        });

        return ok(
            {
                message: "Team created successfully",
                team: result,
            },
            201
        );
    });
}
