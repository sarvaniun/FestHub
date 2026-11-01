
import {
    handle,
    ok,
    parseBody,
} from "@/lib/http";
import { signupSchema } from "@/lib/validators";
import { signup } from "@/lib/signup";
import { setSessionCookie } from "@/lib/auth";

export const POST = async (req: Request): Promise<Response> =>
    handle(async () => {
        const body = await parseBody(req, signupSchema);

        const user = await signup(body);

        await setSessionCookie({
            userId: user.userId,
            email: user.email,
            role: user.role,
            participantId: user.participantId,
            organizerId: null,
        });

        return ok({ user }, 201);
    });
