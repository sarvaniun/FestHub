import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { participantVector, nearestEvents } from "@/lib/vector";

export type Recommendation = {
    Event_ID: number;
    Event_Name: string;
    Event_Type: "Individual" | "Team";
    Start_Time: Date;
    Venue_Name: string;
    Matching_Interests?: number;
    Because_You_Like?: string;
    Similarity?: number;
};

// Events the student is already in, alone or through a team.
export const JOINED_EVENTS_SQL = `
    SELECT r.Event_ID FROM REGISTRATION r
    WHERE r.Participant_ID = ? AND r.Status <> 'Cancelled'
    UNION
    SELECT r.Event_ID FROM REGISTRATION r
    JOIN TEAM_MEMBER tm ON tm.Team_ID = r.Team_ID
    WHERE tm.Participant_ID = ? AND r.Status <> 'Cancelled'`;

// Stage 2 Q19 – the relational baseline:
// events that share at least one interest tag with the student and that
// the student has not joined yet, ranked by how many tags match.
export async function interestRecommendations(
    participantId: number,
    limit = 5
): Promise<Recommendation[]> {
    const result = await rows<Recommendation & { Matching_Interests: number }>(
        db,
        `SELECT e.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time, v.Venue_Name,
                COUNT(*) AS Matching_Interests,
                GROUP_CONCAT(i.Interest_Name ORDER BY i.Interest_Name SEPARATOR ', ') AS Because_You_Like
         FROM PARTICIPANT_INTEREST pi
         JOIN EVENT_INTEREST ei ON ei.Interest_ID = pi.Interest_ID
         JOIN INTERESTS i       ON i.Interest_ID = pi.Interest_ID
         JOIN EVENT e           ON e.Event_ID = ei.Event_ID
         JOIN VENUE v           ON v.Venue_ID = e.Venue_ID
         WHERE pi.Participant_ID = ?
           AND e.Event_ID NOT IN (${JOINED_EVENTS_SQL})
         GROUP BY e.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time, v.Venue_Name
         ORDER BY Matching_Interests DESC, e.Event_Name
         LIMIT ?`,
        [participantId, participantId, participantId, limit]
    );
    return result.map((r) => ({ ...r, Matching_Interests: Number(r.Matching_Interests) }));
}

// Loads event details from MySQL for ids found in pgvector, keeping the
// order (most similar first) and attaching the similarity.
export async function hydrateEvents(
    hits: { event_id: number; similarity: number }[]
): Promise<Recommendation[]> {
    if (hits.length === 0) {
        return [];
    }
    const details = await rows<Recommendation>(
        db,
        `SELECT e.Event_ID, e.Event_Name, e.Event_Type, e.Start_Time, v.Venue_Name, e.Description
         FROM EVENT e
         JOIN VENUE v ON v.Venue_ID = e.Venue_ID
         WHERE e.Event_ID IN (?)`,
        [hits.map((h) => h.event_id)]
    );
    const byId = new Map(details.map((d) => [d.Event_ID, d]));
    return hits
        .filter((h) => byId.has(h.event_id)) // skip vectors of deleted events
        .map((h) => ({ ...byId.get(h.event_id)!, Similarity: Math.round(h.similarity * 1000) / 1000 }));
}

// Vector version: embed the student's interest profile and find the
// closest events by cosine distance, skipping events already joined.
// Returns null when it cannot be used (no interests yet, or Postgres /
// the model is unavailable) so the caller can fall back to Q19.
export async function vectorRecommendations(
    participantId: number,
    limit = 5
): Promise<Recommendation[] | null> {
    try {
        const vector = await participantVector(participantId);
        if (!vector) {
            return null;
        }
        const joined = await rows<{ Event_ID: number }>(db, JOINED_EVENTS_SQL, [participantId, participantId]);
        const hits = await nearestEvents(vector, limit, joined.map((j) => j.Event_ID));
        if (hits.length === 0) {
            return null; // nothing embedded yet → use Q19
        }
        return hydrateEvents(hits);
    } catch (error) {
        console.warn("[vector] recommendations fell back to Q19:", (error as Error).message);
        return null;
    }
}
