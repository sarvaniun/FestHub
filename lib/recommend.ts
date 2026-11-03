import { db } from "@/lib/db";
import { rows } from "@/lib/sql";

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
