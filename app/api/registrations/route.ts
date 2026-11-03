import { z } from "zod";
import { db } from "@/lib/db";
import { rows, one } from "@/lib/sql";
import { handle, ok, parseBody, HttpError } from "@/lib/http";
import { requireRole, requireSession } from "@/lib/auth";
import { callForId } from "@/lib/registrations";

const REGISTRATION_COLUMNS = `
    r.Registration_ID, r.Event_ID, e.Event_Name, e.Event_Type,
    r.Participant_ID, r.Team_ID,
    COALESCE(p.Name, t.Team_Name) AS Registered_By,
    r.Status, r.Registration_Time`;

const REGISTRATION_FROM = `
    FROM REGISTRATION r
    JOIN EVENT e            ON e.Event_ID = r.Event_ID
    LEFT JOIN PARTICIPANT p ON p.Participant_ID = r.Participant_ID
    LEFT JOIN TEAM t        ON t.Team_ID = r.Team_ID`;

// GET /api/registrations
//   Admin     → every registration
//   Organizer → registrations of the events they organize
//   Student   → their own (alone or through a team)
export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireSession();

        let where = "";
        let params: unknown[] = [];
        if (session.role === "ORGANIZER") {
            where = "WHERE r.Event_ID IN (SELECT Event_ID FROM EVENT_ORGANIZER WHERE Organizer_ID = ?)";
            params = [session.organizerId];
        } else if (session.role === "STUDENT") {
            where = `WHERE r.Participant_ID = ?
                        OR r.Team_ID IN (SELECT Team_ID FROM TEAM_MEMBER WHERE Participant_ID = ?)`;
            params = [session.participantId, session.participantId];
        }

        const registrations = await rows(
            db,
            `SELECT ${REGISTRATION_COLUMNS} ${REGISTRATION_FROM} ${where}
             ORDER BY r.Registration_Time DESC`,
            params
        );
        return ok({ registrations });
    });
}

const createSchema = z.object({
    eventId: z.coerce.number().int().positive(),
    teamId: z.coerce.number().int().positive().optional(),
});

// POST /api/registrations  (Student)
//   { eventId }          → register myself          (CALL RegisterParticipant)
//   { eventId, teamId }  → register my team         (CALL RegisterTeam)
// The procedures (sql/20_registrations.sql) do the seat check inside a
// transaction with SELECT ... FOR UPDATE. The database also enforces:
//   duplicate registration      → UNIQUE key        → 409
//   wrong type for the event    → trigger (45000)   → 400 with its message
//   team formed for another event → composite FK    → 400
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");
        if (session.participantId === null) {
            throw new HttpError(403, "This account is not linked to a participant");
        }
        const input = await parseBody(req, createSchema);

        let registrationId: number;
        try {
            if (input.teamId) {
                // Only a member of the team may register it.
                const member = await one(
                    db,
                    "SELECT 1 AS Yes FROM TEAM_MEMBER WHERE Team_ID = ? AND Participant_ID = ?",
                    [input.teamId, session.participantId]
                );
                if (!member) {
                    throw new HttpError(403, "You can only register a team you are a member of");
                }
                registrationId = await callForId("CALL RegisterTeam(?, ?)", [input.eventId, input.teamId]);
            } else {
                registrationId = await callForId("CALL RegisterParticipant(?, ?)", [
                    input.eventId,
                    session.participantId,
                ]);
            }
        } catch (error) {
            // UNIQUE (Event_ID, Participant_ID) / (Event_ID, Team_ID)
            if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
                throw new HttpError(409, input.teamId
                    ? "This team is already registered for this event"
                    : "You are already registered for this event");
            }
            throw error;
        }

        return ok({ registration: { Registration_ID: registrationId, Status: "Pending" } }, 201);
    });
}
