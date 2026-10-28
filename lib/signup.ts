import { one, exec } from "@/lib/sql";
import { withTransaction } from "@/lib/tx";
import { hashPassword } from "@/lib/auth";
import type { SignupInput } from "@/lib/validators";
import { HttpError } from "@/lib/http";

type ParticipantRow = {
    Participant_ID: number;
    Name: string;
    Email: string;
};

type UserRow = {
    User_ID: number;
    Email: string;
    Username: string;
    Role: "STUDENT" | "ORGANIZER" | "ADMIN";
    Participant_ID: number | null;
};

export async function signup(input: SignupInput) {
    const email = input.email.toLowerCase();

    return withTransaction(async (conn) => {
        // Check whether an account already exists.
        const existingUser = await one<UserRow>(
            conn,
            "SELECT User_ID, Email, Username, Role, Participant_ID FROM USER_ACCOUNT WHERE Email = ? OR Username = ?",
            [email, input.username]
        );

        if (existingUser) {
            throw new HttpError(409, "Email or username is already registered");
        }

        // Find an existing participant by email.
        const participant = await one<ParticipantRow>(
            conn,
            "SELECT Participant_ID, Name, Email FROM PARTICIPANT WHERE LOWER(Email) = ?",
            [email]
        );

        let participantId: number;

        if (participant) {
            participantId = participant.Participant_ID;
        } else {
            const result = await exec(
                conn,
                `INSERT INTO PARTICIPANT (Name, Email)
                 VALUES (?, ?)`,
                [input.name, email]
            );

            participantId = result.insertId;
        }

        const passwordHash = await hashPassword(input.password);

        const result = await exec(
            conn,
            `INSERT INTO USER_ACCOUNT
            (Email, Username, Password_Hash, Role, Participant_ID)
             VALUES (?, ?, ?, 'STUDENT', ?)`,
            [email, input.username, passwordHash, participantId]
        );

        return {
            userId: result.insertId,
            email,
            username: input.username,
            role: "STUDENT" as const,
            participantId,
        };
    });
}