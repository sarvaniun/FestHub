import { handle, ok } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { reindexAllEvents } from "@/lib/vector";

// POST /api/vector/reindex  (Admin)
// Embeds every event with all-MiniLM-L6-v2 and stores the vectors in
// pgvector; removes vectors of deleted events. Run once after setup, and
// any time the two databases might have drifted apart.
export async function POST(): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const result = await reindexAllEvents();
        return ok(result);
    });
}
