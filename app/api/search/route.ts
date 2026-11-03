import { z } from "zod";
import { handle, ok, parseBody, HttpError } from "@/lib/http";
import { embed } from "@/lib/embeddings";
import { toVectorLiteral } from "@/lib/pg";
import { nearestEvents } from "@/lib/vector";
import { hydrateEvents } from "@/lib/recommend";

const searchSchema = z.object({
    query: z.string().trim().min(2, { message: "Type at least 2 characters" }).max(200),
    limit: z.coerce.number().int().min(1).max(20).default(5),
});

// POST /api/search  (public)   Body: { query: "something with robots" }
// Semantic search: embed the query with the same model as the events,
// ask pgvector for the nearest event vectors (cosine distance <=>), then
// load the event details from MySQL.
export async function POST(req: Request): Promise<Response> {
    return handle(async () => {
        const { query, limit } = await parseBody(req, searchSchema);

        let hits;
        try {
            const vector = toVectorLiteral(await embed(query));
            hits = await nearestEvents(vector, limit);
        } catch (error) {
            console.warn("[vector] search failed:", (error as Error).message);
            throw new HttpError(503, "Vector search is not available right now (is PostgreSQL running?)");
        }

        const results = await hydrateEvents(hits);
        return ok({ query, results });
    });
}
