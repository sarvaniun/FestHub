import { handle, ok, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { interestRecommendations, vectorRecommendations } from "@/lib/recommend";

// GET /api/recommendations  (Student)
//   default     → vector similarity (pgvector), falling back to Stage 2 Q19
//                 (shared interest tags) if vectors are not available
//   ?compare=1  → both lists side by side, for the report §15 comparison
export async function GET(req: Request): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("STUDENT");
        if (session.participantId === null) {
            throw new HttpError(400, "This account is not linked to a participant");
        }
        const participantId = session.participantId;

        if (new URL(req.url).searchParams.get("compare") === "1") {
            const [vector, interests] = await Promise.all([
                vectorRecommendations(participantId),
                interestRecommendations(participantId),
            ]);
            return ok({ vector: vector ?? [], interests, vectorAvailable: vector !== null });
        }

        const vector = await vectorRecommendations(participantId);
        if (vector) {
            return ok({ method: "vector", recommendations: vector });
        }

        const recommendations = await interestRecommendations(participantId);
        return ok({ method: "interests", recommendations });
    });
}
