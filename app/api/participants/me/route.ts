import { requireRole } from "@/lib/auth";
import { handle, ok, HttpError, parseBody } from "@/lib/http";
import { one, exec } from "@/lib/sql";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validators";


type ParticipantRow = {
    Participant_ID: number;
    Name: string;
    Email: string;
    Phone: string | null;
    Department: string | null;
};

export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student profile not linked");
        }

        const participant = await one<ParticipantRow>(
            db,
            `SELECT
                Participant_ID,
                Name,
                Email,
                Phone,
                Department
             FROM PARTICIPANT
             WHERE Participant_ID = ?`,
            [session.participantId]
        );

        if (!participant) {
            throw new HttpError(404, "Participant profile not found");
        }

        return ok({ participant });
    });
}

export async function PATCH(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");

        if (session.participantId === null) {
            throw new HttpError(403, "Student profile not linked");
        }

        const body = await parseBody(req, updateProfileSchema);

        const fields: string[] = [];
        const values: (string | null)[] = [];

        if (body.name !== undefined) {
            fields.push("Name = ?");
            values.push(body.name);
        }

        if (body.phone !== undefined) {
            fields.push("Phone = ?");
            values.push(body.phone);
        }

        if (body.department !== undefined) {
            fields.push("Department = ?");
            values.push(body.department);
        }

        values.push(String(session.participantId));

        await exec(
            db,
            `UPDATE PARTICIPANT
             SET ${fields.join(", ")}
             WHERE Participant_ID = ?`,
            values
        );

        const participant = await one<ParticipantRow>(
            db,
            `SELECT Participant_ID, Name, Email, Phone, Department
             FROM PARTICIPANT
             WHERE Participant_ID = ?`,
            [session.participantId]
        );

        if (!participant) {
            throw new HttpError(404, "Participant profile not found");
        }

        return ok({ participant });
    });
}
