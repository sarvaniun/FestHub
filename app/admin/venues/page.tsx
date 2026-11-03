"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, formatDateTime } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import "@/components/fh.css";

type Venue = {
    Venue_ID: number;
    Venue_Name: string;
    Capacity: number;
    Location: string | null;
    Events: number;
};

type ScheduleEvent = {
    Event_ID: number;
    Event_Name: string;
    Event_Type: string;
    Start_Time: string;
    End_Time: string;
};

const emptyForm = { name: "", capacity: "", location: "" };

export default function AdminVenuesPage() {
    const { user, loading } = useAuthUser(["ADMIN"]);
    const [venues, setVenues] = useState<Venue[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [schedule, setSchedule] = useState<{ venue: Venue; events: ScheduleEvent[] } | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        try {
            const data = await api<{ venues: Venue[] }>("/api/venues");
            setVenues(data.venues);
        } catch (e) {
            setError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        if (user) load();
    }, [user, load]);

    async function save(event: FormEvent) {
        event.preventDefault();
        setError("");
        setMessage("");
        const body = {
            name: form.name,
            capacity: Number(form.capacity),
            location: form.location || null,
        };
        try {
            if (editingId) {
                await api(`/api/venues/${editingId}`, { method: "PUT", body });
                setMessage("Venue updated.");
            } else {
                await api("/api/venues", { method: "POST", body });
                setMessage("Venue added.");
            }
            setForm(emptyForm);
            setEditingId(null);
            load();
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function remove(venue: Venue) {
        if (!confirm(`Delete ${venue.Venue_Name}?`)) return;
        setError("");
        setMessage("");
        try {
            await api(`/api/venues/${venue.Venue_ID}`, { method: "DELETE" });
            setMessage("Venue deleted.");
            load();
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function showSchedule(venue: Venue) {
        setError("");
        try {
            const data = await api<{ venue: Venue; events: ScheduleEvent[] }>(
                `/api/venues/${venue.Venue_ID}/schedule`
            );
            setSchedule(data);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    function startEdit(venue: Venue) {
        setEditingId(venue.Venue_ID);
        setForm({
            name: venue.Venue_Name,
            capacity: String(venue.Capacity),
            location: venue.Location ?? "",
        });
    }

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Venues</h1>
                    <p className="fh-muted">Add, edit and delete venues, and see each venue&apos;s schedule.</p>
                </div>
                <Link href="/admin/dashboard" className="fh-muted">← Back to dashboard</Link>
            </div>

            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>{editingId ? "Edit venue" : "Add a venue"}</h2>
                <form className="fh-form" onSubmit={save}>
                    <label>
                        Name
                        <input className="fh-input" required value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label>
                        Capacity
                        <input className="fh-input" type="number" min={1} required value={form.capacity}
                            onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                    </label>
                    <label>
                        Location
                        <input className="fh-input" value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })} />
                    </label>
                    <div className="fh-actions">
                        <button className="fh-btn" type="submit">{editingId ? "Save" : "Add venue"}</button>
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
                <h2>All venues</h2>
                <div className="fh-table-wrap">
                    <table className="fh-table">
                        <thead>
                            <tr><th>Name</th><th>Capacity</th><th>Location</th><th>Events</th><th></th></tr>
                        </thead>
                        <tbody>
                            {venues.map((v) => (
                                <tr key={v.Venue_ID}>
                                    <td>{v.Venue_Name}</td>
                                    <td>{v.Capacity}</td>
                                    <td>{v.Location ?? "—"}</td>
                                    <td>{v.Events}</td>
                                    <td>
                                        <div className="fh-actions">
                                            <button className="fh-btn fh-btn-secondary fh-btn-small" onClick={() => showSchedule(v)}>Schedule</button>
                                            <button className="fh-btn fh-btn-secondary fh-btn-small" onClick={() => startEdit(v)}>Edit</button>
                                            <button className="fh-btn fh-btn-danger fh-btn-small" onClick={() => remove(v)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {venues.length === 0 && (
                                <tr><td colSpan={5} className="fh-muted">No venues yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {schedule && (
                <section className="fh-card">
                    <h2>Schedule: {schedule.venue.Venue_Name}</h2>
                    {schedule.events.length === 0 ? (
                        <p className="fh-muted">No events at this venue.</p>
                    ) : (
                        <table className="fh-table">
                            <thead><tr><th>Event</th><th>Type</th><th>Starts</th><th>Ends</th></tr></thead>
                            <tbody>
                                {schedule.events.map((e) => (
                                    <tr key={e.Event_ID}>
                                        <td><Link href={`/events/${e.Event_ID}`}>{e.Event_Name}</Link></td>
                                        <td>{e.Event_Type}</td>
                                        <td>{formatDateTime(e.Start_Time)}</td>
                                        <td>{formatDateTime(e.End_Time)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            )}
        </main>
    );
}
