import { handle, ok, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { interestRecommendations } from "@/lib/recommend";

// GET /api/recommendations  (Student)
// "Recommended for you": Stage 2 Q19 (shared interest tags, minus events
// the student already joined).
export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");
        if (session.participantId === null) {
            throw new HttpError(400, "This account is not linked to a participant");
        }

        const recommendations = await interestRecommendations(session.participantId);
        return ok({ method: "interests", recommendations });
    });
}
