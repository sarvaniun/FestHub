import { getSession } from "@/lib/auth";
import { handle, ok, HttpError } from "@/lib/http";

export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await getSession();

        if (!session) {
            throw new HttpError(401, "Not authenticated");
        }

        return ok({ user: session });
    });
}
