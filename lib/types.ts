// Shapes of the JSON our events-side API routes return (used by pages).

export type EventSummary = {
    Event_ID: number;
    Event_Name: string;
    Description: string | null;
    Start_Time: string;
    End_Time: string;
    Budget: number;
    Event_Type: "Individual" | "Team";
    Venue_ID: number;
    Venue_Name: string;
    Location: string | null;
    Capacity: number;
    Seats_Taken: number;
    Seats_Left: number;
};

export type EventDetails = EventSummary & {
    organizers: { Organizer_ID: number; Name: string; Club: string | null }[];
    judges: { Judge_ID: number; Name: string; Expertise: string | null }[];
    tags: { Interest_ID: number; Interest_Name: string }[];
};

export type VenueOption = {
    Venue_ID: number;
    Venue_Name: string;
    Capacity: number;
    Location: string | null;
};
