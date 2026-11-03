// SQL pieces shared by several event routes.

// Seats taken by one event (alias e): an individual registration takes 1
// seat, a team registration takes one seat per member. Cancelled
// registrations do not count. Same idea as Stage 2 query Q6.
export const SEATS_TAKEN_SQL = `
    COALESCE((
        SELECT SUM(CASE
                     WHEN r.Participant_ID IS NOT NULL THEN 1
                     ELSE (SELECT COUNT(*) FROM TEAM_MEMBER tm
                           WHERE tm.Team_ID = r.Team_ID)
                   END)
        FROM REGISTRATION r
        WHERE r.Event_ID = e.Event_ID
          AND r.Status <> 'Cancelled'
    ), 0)`;

// Columns returned for an event in lists.
export const EVENT_LIST_COLUMNS = `
    e.Event_ID, e.Event_Name, e.Description, e.Start_Time, e.End_Time,
    e.Budget, e.Event_Type, e.Venue_ID,
    v.Venue_Name, v.Location, v.Capacity,
    ${SEATS_TAKEN_SQL} AS Seats_Taken`;

export type EventListRow = {
    Event_ID: number;
    Event_Name: string;
    Description: string | null;
    Start_Time: Date;
    End_Time: Date;
    Budget: string;
    Event_Type: "Individual" | "Team";
    Venue_ID: number;
    Venue_Name: string;
    Location: string | null;
    Capacity: number;
    Seats_Taken: string | number;
};

// Adds Seats_Left and turns the DECIMAL/SUM strings into numbers.
export function withSeats(row: EventListRow) {
    const taken = Number(row.Seats_Taken);
    return {
        ...row,
        Budget: Number(row.Budget),
        Seats_Taken: taken,
        Seats_Left: Math.max(row.Capacity - taken, 0),
    };
}
