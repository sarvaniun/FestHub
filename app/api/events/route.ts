import { db } from "@/lib/db";
import {rows} from "@/lib/sql"
import {handle,ok} from "@/lib/http"

type EventRow = {
    Event_ID: number;
    Event_Name: string;
    Description: string|null;
    Start_Time: Date;
    End_Time: Date;
    Budget: string|number;
    Event_Type: "Individual"|"Team";
    Venue_ID: number;
}

export async function GET(): Promise<Response> {
    return handle( async () => {
        const events = await rows<EventRow>(
            db,`SELECT Event_ID,Event_Name,Description,Start_Time,End_Time,Budget,Event_Type,Venue_ID
            FROM EVENT
            ORDER BY Start_Time ASC`
        );
        return ok({events});
    })
}