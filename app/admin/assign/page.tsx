"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import type { EventDetails, EventSummary } from "@/lib/types";
import "@/components/fh.css";

type Organizer = { Organizer_ID: number; Name: string; Club: string | null; Email: string; Events: number };
type Judge = { Judge_ID: number; Name: string; Expertise: string | null; Email: string; Events: number };

export default function AssignPage() {
    const { user, loading } = useAuthUser(["ADMIN"]);
    const [events, setEvents] = useState<EventSummary[]>([]);
    const [organizers, setOrganizers] = useState<Organizer[]>([]);
    const [judges, setJudges] = useState<Judge[]>([]);
    const [eventId, setEventId] = useState("");
    const [details, setDetails] = useState<EventDetails | null>(null);
    const [pickOrganizer, setPickOrganizer] = useState("");
    const [pickJudge, setPickJudge] = useState("");
    const [newOrganizer, setNewOrganizer] = useState({ name: "", email: "", club: "", phone: "" });
    const [newJudge, setNewJudge] = useState({ name: "", email: "", expertise: "", phone: "" });
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadPeople = useCallback(async () => {
        const [e, o, j] = await Promise.all([
            api<{ events: EventSummary[] }>("/api/events"),
            api<{ organizers: Organizer[] }>("/api/organizers"),
            api<{ judges: Judge[] }>("/api/judges"),
        ]);
        setEvents(e.events);
        setOrganizers(o.organizers);
        setJudges(j.judges);
    }, []);

    const loadDetails = useCallback(async (id: string) => {
        if (!id) {
            setDetails(null);
            return;
        }
        const d = await api<{ event: EventDetails }>(`/api/events/${id}`);
        setDetails(d.event);
    }, []);

    useEffect(() => {
        if (user) loadPeople().catch((e: Error) => setError(e.message));
    }, [user, loadPeople]);

    useEffect(() => {
        loadDetails(eventId).catch((e: Error) => setError(e.message));
    }, [eventId, loadDetails]);

    async function run(action: () => Promise<unknown>, success: string) {
        setError("");
        setMessage("");
        try {
            await action();
            setMessage(success);
            await Promise.all([loadPeople(), loadDetails(eventId)]);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    function addOrganizer(event: FormEvent) {
        event.preventDefault();
        run(async () => {
            await api("/api/organizers", { method: "POST", body: newOrganizer });
            setNewOrganizer({ name: "", email: "", club: "", phone: "" });
        }, "Organizer added.");
    }

    function addJudge(event: FormEvent) {
        event.preventDefault();
        run(async () => {
            await api("/api/judges", { method: "POST", body: newJudge });
            setNewJudge({ name: "", email: "", expertise: "", phone: "" });
        }, "Judge added.");
    }

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    const assignedOrganizerIds = new Set(details?.organizers.map((o) => o.Organizer_ID));
    const assignedJudgeIds = new Set(details?.judges.map((j) => j.Judge_ID));

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Organizers and judges</h1>
                    <p className="fh-muted">Assign organizers and judges to events, and add new ones.</p>
                </div>
                <Link href="/admin/dashboard" className="fh-muted">← Back to dashboard</Link>
            </div>

            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>Choose an event</h2>
                <select className="fh-select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                    <option value="">Select an event</option>
                    {events.map((e) => (
                        <option key={e.Event_ID} value={e.Event_ID}>{e.Event_Name}</option>
                    ))}
                </select>
            </section>

            {details && (
                <div className="fh-two-col">
                    <section className="fh-card">
                        <h2>Organizers of {details.Event_Name}</h2>
                        <table className="fh-table">
                            <tbody>
                                {details.organizers.map((o) => (
                                    <tr key={o.Organizer_ID}>
                                        <td>{o.Name}{o.Club ? ` (${o.Club})` : ""}</td>
                                        <td style={{ textAlign: "right" }}>
                                            <button className="fh-btn fh-btn-danger fh-btn-small"
                                                onClick={() => run(() => api(`/api/events/${eventId}/organizers/${o.Organizer_ID}`, { method: "DELETE" }), "Organizer removed.")}>
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {details.organizers.length === 0 && (
                                    <tr><td className="fh-muted">None yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                        <div className="fh-actions" style={{ marginTop: 14 }}>
                            <select className="fh-select" value={pickOrganizer} onChange={(e) => setPickOrganizer(e.target.value)}>
                                <option value="">Add an organizer…</option>
                                {organizers.filter((o) => !assignedOrganizerIds.has(o.Organizer_ID)).map((o) => (
                                    <option key={o.Organizer_ID} value={o.Organizer_ID}>{o.Name}</option>
                                ))}
                            </select>
                            <button className="fh-btn" disabled={!pickOrganizer}
                                onClick={() => run(async () => {
                                    await api(`/api/events/${eventId}/organizers/${pickOrganizer}`, { method: "POST" });
                                    setPickOrganizer("");
                                }, "Organizer assigned.")}>
                                Assign
                            </button>
                        </div>
                    </section>

                    <section className="fh-card">
                        <h2>Judges of {details.Event_Name}</h2>
                        <table className="fh-table">
                            <tbody>
                                {details.judges.map((j) => (
                                    <tr key={j.Judge_ID}>
                                        <td>{j.Name}{j.Expertise ? ` – ${j.Expertise}` : ""}</td>
                                        <td style={{ textAlign: "right" }}>
                                            <button className="fh-btn fh-btn-danger fh-btn-small"
                                                onClick={() => run(() => api(`/api/events/${eventId}/judges/${j.Judge_ID}`, { method: "DELETE" }), "Judge removed.")}>
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {details.judges.length === 0 && (
                                    <tr><td className="fh-muted">None yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                        <div className="fh-actions" style={{ marginTop: 14 }}>
                            <select className="fh-select" value={pickJudge} onChange={(e) => setPickJudge(e.target.value)}>
                                <option value="">Add a judge…</option>
                                {judges.filter((j) => !assignedJudgeIds.has(j.Judge_ID)).map((j) => (
                                    <option key={j.Judge_ID} value={j.Judge_ID}>{j.Name}</option>
                                ))}
                            </select>
                            <button className="fh-btn" disabled={!pickJudge}
                                onClick={() => run(async () => {
                                    await api(`/api/events/${eventId}/judges/${pickJudge}`, { method: "POST" });
                                    setPickJudge("");
                                }, "Judge assigned.")}>
                                Assign
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <div className="fh-two-col">
                <section className="fh-card">
                    <h2>Add an organizer</h2>
                    <form className="fh-form" onSubmit={addOrganizer}>
                        <label>Name<input className="fh-input" required value={newOrganizer.name}
                            onChange={(e) => setNewOrganizer({ ...newOrganizer, name: e.target.value })} /></label>
                        <label>Email<input className="fh-input" type="email" required value={newOrganizer.email}
                            onChange={(e) => setNewOrganizer({ ...newOrganizer, email: e.target.value })} /></label>
                        <label>Club<input className="fh-input" value={newOrganizer.club}
                            onChange={(e) => setNewOrganizer({ ...newOrganizer, club: e.target.value })} /></label>
                        <label>Phone<input className="fh-input" value={newOrganizer.phone}
                            onChange={(e) => setNewOrganizer({ ...newOrganizer, phone: e.target.value })} /></label>
                        <button className="fh-btn" type="submit">Add organizer</button>
                    </form>
                    <table className="fh-table" style={{ marginTop: 16 }}>
                        <thead><tr><th>Name</th><th>Club</th><th>Events</th><th></th></tr></thead>
                        <tbody>
                            {organizers.map((o) => (
                                <tr key={o.Organizer_ID}>
                                    <td>{o.Name}<div className="fh-muted">{o.Email}</div></td>
                                    <td>{o.Club ?? "—"}</td>
                                    <td>{o.Events}</td>
                                    <td>
                                        <button className="fh-btn fh-btn-danger fh-btn-small"
                                            onClick={() => confirm(`Delete ${o.Name}?`) && run(() => api(`/api/organizers/${o.Organizer_ID}`, { method: "DELETE" }), "Organizer deleted.")}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section className="fh-card">
                    <h2>Add a judge</h2>
                    <form className="fh-form" onSubmit={addJudge}>
                        <label>Name<input className="fh-input" required value={newJudge.name}
                            onChange={(e) => setNewJudge({ ...newJudge, name: e.target.value })} /></label>
                        <label>Email<input className="fh-input" type="email" required value={newJudge.email}
                            onChange={(e) => setNewJudge({ ...newJudge, email: e.target.value })} /></label>
                        <label>Expertise<input className="fh-input" value={newJudge.expertise}
                            onChange={(e) => setNewJudge({ ...newJudge, expertise: e.target.value })} /></label>
                        <label>Phone<input className="fh-input" value={newJudge.phone}
                            onChange={(e) => setNewJudge({ ...newJudge, phone: e.target.value })} /></label>
                        <button className="fh-btn" type="submit">Add judge</button>
                    </form>
                    <table className="fh-table" style={{ marginTop: 16 }}>
                        <thead><tr><th>Name</th><th>Expertise</th><th>Events</th><th></th></tr></thead>
                        <tbody>
                            {judges.map((j) => (
                                <tr key={j.Judge_ID}>
                                    <td>{j.Name}<div className="fh-muted">{j.Email}</div></td>
                                    <td>{j.Expertise ?? "—"}</td>
                                    <td>{j.Events}</td>
                                    <td>
                                        <button className="fh-btn fh-btn-danger fh-btn-small"
                                            onClick={() => confirm(`Delete ${j.Name}?`) && run(() => api(`/api/judges/${j.Judge_ID}`, { method: "DELETE" }), "Judge deleted.")}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </main>
    );
}
