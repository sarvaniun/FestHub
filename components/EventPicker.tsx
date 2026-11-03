"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { EventSummary } from "@/lib/types";

// Dropdown of the events the user may manage:
// admins see every event, organizers only their own (?mine=1).
export default function EventPicker({
    role,
    value,
    onChange,
}: {
    role: "ADMIN" | "ORGANIZER";
    value: string;
    onChange: (eventId: string) => void;
}) {
    const [events, setEvents] = useState<EventSummary[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        api<{ events: EventSummary[] }>(role === "ADMIN" ? "/api/events" : "/api/events?mine=1")
            .then((d) => setEvents(d.events))
            .catch((e: Error) => setError(e.message));
    }, [role]);

    return (
        <div>
            {error && <div className="fh-error">{error}</div>}
            <select className="fh-select" value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">Select an event</option>
                {events.map((e) => (
                    <option key={e.Event_ID} value={e.Event_ID}>{e.Event_Name}</option>
                ))}
            </select>
            {!error && events.length === 0 && (
                <p className="fh-muted" style={{ marginTop: 8 }}>
                    {role === "ORGANIZER" ? "You are not assigned to any event yet." : "No events yet."}
                </p>
            )}
        </div>
    );
}
