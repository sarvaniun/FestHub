import { db } from "@/lib/db";
import { rows, one } from "@/lib/sql";
import { pg, toVectorLiteral } from "@/lib/pg";
import { embed, EMBEDDING_MODEL } from "@/lib/embeddings";

type EventText = {
    Event_ID: number;
    Event_Name: string;
    Event_Type: string;
    Description: string | null;
    Tags: string | null;
};

const EVENT_TEXT_SQL = `
    SELECT e.Event_ID, e.Event_Name, e.Event_Type, e.Description,
           GROUP_CONCAT(i.Interest_Name ORDER BY i.Interest_Name SEPARATOR ', ') AS Tags
    FROM EVENT e
    LEFT JOIN EVENT_INTEREST ei ON ei.Event_ID = e.Event_ID
    LEFT JOIN INTERESTS i       ON i.Interest_ID = ei.Interest_ID`;

// The text we embed for an event: name + type + description + tags.
function eventText(e: EventText): string {
    return [
        `${e.Event_Name}.`,
        `${e.Event_Type} event.`,
        e.Description ? `${e.Description}` : "",
        e.Tags ? `Topics: ${e.Tags}.` : "",
    ]
        .filter(Boolean)
        .join(" ");
}

async function upsertEvent(e: EventText): Promise<void> {
    const content = eventText(e);
    const vector = await embed(content);
    await pg.query(
        `INSERT INTO event_embedding (event_id, content, embedding, model_name, updated_at)
         VALUES ($1, $2, $3::vector, $4, now())
         ON CONFLICT (event_id) DO UPDATE
            SET content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                model_name = EXCLUDED.model_name,
                updated_at = now()`,
        [e.Event_ID, content, toVectorLiteral(vector), EMBEDDING_MODEL]
    );
}

// Re-embed one event after it is created/edited or its tags change.
// "Best effort": if Postgres is down we log it and carry on, so a vector
// problem never breaks the MySQL operation. "Re-embed all" fixes it later.
export async function syncEventEmbedding(eventId: number): Promise<void> {
    try {
        const e = await one<EventText>(
            db,
            `${EVENT_TEXT_SQL} WHERE e.Event_ID = ? GROUP BY e.Event_ID, e.Event_Name, e.Event_Type, e.Description`,
            [eventId]
        );
        if (e) {
            await upsertEvent(e);
        }
    } catch (error) {
        console.warn(`[vector] could not embed event ${eventId}:`, (error as Error).message);
    }
}

export async function deleteEventEmbedding(eventId: number): Promise<void> {
    try {
        await pg.query("DELETE FROM event_embedding WHERE event_id = $1", [eventId]);
    } catch (error) {
        console.warn(`[vector] could not delete event ${eventId}:`, (error as Error).message);
    }
}

// Embed every event, and remove vectors of events that no longer exist.
export async function reindexAllEvents(): Promise<{ embedded: number; removed: number }> {
    const events = await rows<EventText>(
        db,
        `${EVENT_TEXT_SQL} GROUP BY e.Event_ID, e.Event_Name, e.Event_Type, e.Description ORDER BY e.Event_ID`
    );
    for (const e of events) {
        await upsertEvent(e);
    }
    const ids = events.map((e) => e.Event_ID);
    const removed = await pg.query(
        "DELETE FROM event_embedding WHERE NOT (event_id = ANY($1::int[]))",
        [ids]
    );
    return { embedded: events.length, removed: removed.rowCount ?? 0 };
}

// Builds the student's interest profile, embeds it and stores it in
// participant_embedding. Returns the vector, or null if the student has
// no interests yet.
export async function participantVector(participantId: number): Promise<string | null> {
    const profile = await one<{ Interests: string | null }>(
        db,
        `SELECT GROUP_CONCAT(i.Interest_Name ORDER BY i.Interest_Name SEPARATOR ', ') AS Interests
         FROM PARTICIPANT_INTEREST pi
         JOIN INTERESTS i ON i.Interest_ID = pi.Interest_ID
         WHERE pi.Participant_ID = ?`,
        [participantId]
    );
    if (!profile?.Interests) {
        return null;
    }

    const content = `Student interested in: ${profile.Interests}.`;
    const vector = toVectorLiteral(await embed(content));
    await pg.query(
        `INSERT INTO participant_embedding (participant_id, content, embedding, model_name, updated_at)
         VALUES ($1, $2, $3::vector, $4, now())
         ON CONFLICT (participant_id) DO UPDATE
            SET content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                model_name = EXCLUDED.model_name,
                updated_at = now()`,
        [participantId, content, vector, EMBEDDING_MODEL]
    );
    return vector;
}

// Nearest events to a vector by cosine distance (<=>), skipping some ids.
export async function nearestEvents(
    vector: string,
    limit: number,
    excludeIds: number[] = []
): Promise<{ event_id: number; similarity: number }[]> {
    const result = await pg.query<{ event_id: number; similarity: string }>(
        `SELECT event_id, 1 - (embedding <=> $1::vector) AS similarity
         FROM event_embedding
         WHERE NOT (event_id = ANY($2::int[]))
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [vector, excludeIds, limit]
    );
    return result.rows.map((r) => ({ event_id: r.event_id, similarity: Number(r.similarity) }));
}
