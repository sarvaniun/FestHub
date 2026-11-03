"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, formatDateTime, formatRupees, toDateTimeInput } from "@/lib/api-client";
import type { EventSummary, VenueOption } from "@/lib/types";
import "@/components/fh.css";

type Props = {
    // "all": admin sees every event and can delete.
    // "mine": organizer sees only the events they run.
    scope: "all" | "mine";
};

const emptyForm = {
    name: "",
    description: "",
    startTime: "",
    endTime: "",
    budget: "",
    eventType: "Individual",
    venueId: "",
};

// Create / edit / delete events. Used by /admin/events and /organizer/events.
export default function EventManager({ scope }: Props) {
    const [events, setEvents] = useState<EventSummary[]>([]);
    const [venues, setVenues] = useState<VenueOption[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        try {
            const [e, v] = await Promise.all([
                api<{ events: EventSummary[] }>(scope === "mine" ? "/api/events?mine=1" : "/api/events"),
                api<{ venues: VenueOption[] }>("/api/venues"),
            ]);
            setEvents(e.events);
            setVenues(v.venues);
        } catch (err) {
            setError((err as Error).message);
        }
    }, [scope]);

    useEffect(() => {
        load();
    }, [load]);

    async function save(event: FormEvent) {
        event.preventDefault();
        setError("");
        setMessage("");
        const body = {
            name: form.name,
            description: form.description || null,
            startTime: form.startTime,
            endTime: form.endTime,
            budget: Number(form.budget),
            eventType: form.eventType,
            venueId: Number(form.venueId),
        };
        try {
            if (editingId) {
                await api(`/api/events/${editingId}`, { method: "PUT", body });
                setMessage("Event updated.");
            } else {
                await api("/api/events", { method: "POST", body });
                setMessage("Event created.");
            }
            setForm(emptyForm);
            setEditingId(null);
            load();
        } catch (err) {
            // e.g. the venue double-booking trigger's message
            setError((err as Error).message);
        }
    }

    async function remove(e: EventSummary) {
        if (!confirm(`Delete ${e.Event_Name}? Its registrations and expenses are deleted too.`)) return;
        setError("");
        setMessage("");
        try {
            await api(`/api/events/${e.Event_ID}`, { method: "DELETE" });
            setMessage("Event deleted.");
            load();
        } catch (err) {
            setError((err as Error).message);
        }
    }

    function startEdit(e: EventSummary) {
        setEditingId(e.Event_ID);
        setForm({
            name: e.Event_Name,
            description: e.Description ?? "",
            startTime: toDateTimeInput(e.Start_Time),
            endTime: toDateTimeInput(e.End_Time),
            budget: String(e.Budget),
            eventType: e.Event_Type,
            venueId: String(e.Venue_ID),
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return (
        <>
            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>{editingId ? "Edit event" : "Create an event"}</h2>
                <form className="fh-form" onSubmit={save}>
                    <label>
                        Name
                        <input className="fh-input" required value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label>
                        Type
                        <select className="fh-select" value={form.eventType}
                            onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                            <option value="Individual">Individual</option>
                            <option value="Team">Team</option>
                        </select>
                    </label>
                    <label>
                        Venue
                        <select className="fh-select" required value={form.venueId}
                            onChange={(e) => setForm({ ...form, venueId: e.target.value })}>
                            <option value="">Choose a venue</option>
                            {venues.map((v) => (
                                <option key={v.Venue_ID} value={v.Venue_ID}>
                                    {v.Venue_Name} ({v.Capacity} seats)
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Starts
                        <input className="fh-input" type="datetime-local" required value={form.startTime}
                            onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                    </label>
                    <label>
                        Ends
                        <input className="fh-input" type="datetime-local" required value={form.endTime}
                            onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                    </label>
                    <label>
                        Budget (₹)
                        <input className="fh-input" type="number" min={0} step="0.01" required value={form.budget}
                            onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                    </label>
                    <label className="fh-full">
                        Description
                        <textarea className="fh-textarea" value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </label>
                    <div className="fh-actions">
                        <button className="fh-btn" type="submit">{editingId ? "Save changes" : "Create event"}</button>
                        {editingId && (
                            <button className="fh-btn fh-btn-secondary" type="button"
                                onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </section>

            <section className="fh-card">
                <h2>{scope === "mine" ? "My events" : "All events"}</h2>
                <div className="fh-table-wrap">
                    <table className="fh-table">
                        <thead>
                            <tr><th>Event</th><th>Type</th><th>When</th><th>Venue</th><th>Seats</th><th>Budget</th><th></th></tr>
                        </thead>
                        <tbody>
                            {events.map((e) => (
                                <tr key={e.Event_ID}>
                                    <td><Link href={`/events/${e.Event_ID}`}>{e.Event_Name}</Link></td>
                                    <td>{e.Event_Type}</td>
                                    <td>{formatDateTime(e.Start_Time)}</td>
                                    <td>{e.Venue_Name}</td>
                                    <td>{e.Seats_Taken}/{e.Capacity}</td>
                                    <td>{formatRupees(e.Budget)}</td>
                                    <td>
                                        <div className="fh-actions">
                                            <button className="fh-btn fh-btn-secondary fh-btn-small" onClick={() => startEdit(e)}>Edit</button>
                                            {scope === "all" && (
                                                <button className="fh-btn fh-btn-danger fh-btn-small" onClick={() => remove(e)}>Delete</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {events.length === 0 && (
                                <tr><td colSpan={7} className="fh-muted">No events yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
