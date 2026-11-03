import type { Session } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/sql";
import { HttpError } from "@/lib/http";

// Who may look at a participant's data:
//   Admin and organizers → anyone (they run the events)
//   Student              → only themselves
export function assertCanViewParticipant(session: Session, participantId: number): void {
    if (session.role === "STUDENT" && session.participantId !== participantId) {
        throw new HttpError(403, "You can only see your own profile");
    }
}

export async function assertParticipantExists(participantId: number): Promise<void> {
    const p = await one(db, "SELECT Participant_ID FROM PARTICIPANT WHERE Participant_ID = ?", [participantId]);
    if (!p) {
        throw new HttpError(404, "Participant not found");
    }
}
