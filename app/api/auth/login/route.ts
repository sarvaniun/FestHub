import { handle, ok, parseBody, HttpError } from "@/lib/http";
import { one } from "@/lib/sql";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validators";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import type { Role } from "@/lib/config";

type UserRow = {
    User_ID: number;
    Email: string;
    Username: string;
    Password_Hash: string;
    Role: Role;
    Participant_ID: number | null;
    Organizer_ID: number | null;
    Is_Active: number | boolean;
};

export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        const body = await parseBody(req, loginSchema);
        const identifier = body.identifier.trim();

        const user = await one<UserRow>(
            db,
            `SELECT
                User_ID,
                Email,
                Username,
                Password_Hash,
                Role,
                Participant_ID,
                Organizer_ID,
                Is_Active
             FROM USER_ACCOUNT
             WHERE LOWER(Email) = LOWER(?)
                OR LOWER(Username) = LOWER(?)
             LIMIT 1`,
            [identifier, identifier]
        );

        if (
            !user ||
            !user.Is_Active ||
            !(await verifyPassword(body.password, user.Password_Hash))
        ) {
            throw new HttpError(401, "Invalid email/username or password");
        }

        await setSessionCookie({
            userId: user.User_ID,
            email: user.Email,
            role: user.Role,
            participantId: user.Participant_ID,
            organizerId: user.Organizer_ID,
        });

        return ok({
            user: {
                userId: user.User_ID,
                email: user.Email,
                username: user.Username,
                role: user.Role,
                participantId: user.Participant_ID,
                organizerId: user.Organizer_ID,
            },
        });
    });
}
