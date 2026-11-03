"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, formatDateTime } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import EventPicker from "@/components/EventPicker";
import "@/components/fh.css";

type Registration = {
    Registration_ID: number;
    Registered_By: string;
    Kind: "Individual" | "Team";
    Status: "Pending" | "Confirmed" | "Cancelled";
    Registration_Time: string;
};

const statusClass = (s: string) =>
    s === "Confirmed" ? "fh-badge fh-badge-green" : s === "Cancelled" ? "fh-badge fh-badge-red" : "fh-badge fh-badge-amber";

// Organizers (and admins) see each event's registrations and confirm / cancel them.
export default function OrganizerRegistrationsPage() {
    const { user, loading } = useAuthUser(["ADMIN", "ORGANIZER"]);
    const [eventId, setEventId] = useState("");
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [filter, setFilter] = useState("All");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async (id: string) => {
        if (!id) return;
        const d = await api<{ registrations: Registration[] }>(`/api/events/${id}/registrations`);
        setRegistrations(d.registrations);
    }, []);

    useEffect(() => {
        load(eventId).catch((e: Error) => setError(e.message));
    }, [eventId, load]);

    async function setStatus(r: Registration, status: Registration["Status"]) {
        setError("");
        setMessage("");
        try {
            await api(`/api/registrations/${r.Registration_ID}`, { method: "PUT", body: { status } });
            setMessage(`${r.Registered_By}: ${status}.`);
            load(eventId);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    const shown = filter === "All" ? registrations : registrations.filter((r) => r.Status === filter);
    const count = (s: string) => registrations.filter((r) => r.Status === s).length;

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Registrations</h1>
                    <p className="fh-muted">Confirm or cancel the registrations for your events.</p>
                </div>
                <Link href={user.role === "ADMIN" ? "/admin/dashboard" : "/organizer/dashboard"} className="fh-muted">
                    ← Back to dashboard
                </Link>
            </div>

            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>Event</h2>
                <EventPicker role={user.role === "ADMIN" ? "ADMIN" : "ORGANIZER"} value={eventId} onChange={setEventId} />
            </section>

            {eventId && (
                <section className="fh-card">
                    <div className="fh-filters">
                        {["All", "Pending", "Confirmed", "Cancelled"].map((s) => (
                            <button key={s} type="button"
                                className={filter === s ? "fh-btn fh-btn-small" : "fh-btn fh-btn-secondary fh-btn-small"}
                                onClick={() => setFilter(s)}>
                                {s} ({s === "All" ? registrations.length : count(s)})
                            </button>
                        ))}
                    </div>
                    <div className="fh-table-wrap">
                        <table className="fh-table">
                            <thead><tr><th>#</th><th>Name / Team</th><th>Kind</th><th>Registered</th><th>Status</th><th></th></tr></thead>
                            <tbody>
                                {shown.map((r) => (
                                    <tr key={r.Registration_ID}>
                                        <td>{r.Registration_ID}</td>
                                        <td>{r.Registered_By}</td>
                                        <td>{r.Kind}</td>
                                        <td>{formatDateTime(r.Registration_Time)}</td>
                                        <td><span className={statusClass(r.Status)}>{r.Status}</span></td>
                                        <td>
                                            <div className="fh-actions">
                                                {r.Status !== "Confirmed" && (
                                                    <button className="fh-btn fh-btn-small" onClick={() => setStatus(r, "Confirmed")}>Confirm</button>
                                                )}
                                                {r.Status !== "Cancelled" && (
                                                    <button className="fh-btn fh-btn-danger fh-btn-small" onClick={() => setStatus(r, "Cancelled")}>Cancel</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {shown.length === 0 && <tr><td colSpan={6} className="fh-muted">No registrations.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </main>
    );
}
