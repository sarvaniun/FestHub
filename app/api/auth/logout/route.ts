
import { clearSessionCookie } from "@/lib/auth";
import { handle, ok } from "@/lib/http";

export async function POST(): Promise<Response> {
    return handle(async () => {
        await clearSessionCookie();

        return ok({
            message: "Logged out successfully",
        });
    });
}
