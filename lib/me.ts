import { requireRole, type Session } from "@/lib/auth";
import { HttpError } from "@/lib/http";

// For /api/me/* routes: the logged-in student and their Participant_ID.
export async function requireStudent(): Promise<Session & { participantId: number }> {
    const session = await requireRole("STUDENT");
    if (session.participantId === null) {
        throw new HttpError(403, "This account is not linked to a participant");
    }
    return session as Session & { participantId: number };
}
