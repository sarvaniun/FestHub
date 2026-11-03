"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, formatDateTime } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import Recommendations from "@/components/Recommendations";
import InterestsPicker from "@/components/InterestsPicker";
import "@/components/fh.css";

// Member B's team page (issue #21). Change this one line if it lives elsewhere.
const TEAMS_PAGE = "/student/teams";

type Registration = {
    Registration_ID: number;
    Event_ID: number;
    Event_Name: string;
    Event_Type: string;
    Start_Time: string;
    Venue_Name: string;
    Joined_As: "Individual" | "Team";
    Team_Name: string | null;
    Status: "Pending" | "Confirmed" | "Cancelled";
};

type Team = {
    Team_ID: number;
    Team_Name: string;
    Event_ID: number;
    Event_Name: string;
    Members: number;
    Member_Names: string | null;
    Registration_Status: string | null;
};

const statusClass = (s: string) =>
    s === "Confirmed" ? "fh-badge fh-badge-green" : s === "Cancelled" ? "fh-badge fh-badge-red" : "fh-badge fh-badge-amber";

export default function StudentDashboard() {
    const { user, loading } = useAuthUser(["STUDENT"]);
    const [name, setName] = useState("");
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [recKey, setRecKey] = useState(0);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        const [p, r, t] = await Promise.all([
            api<{ participant: { Name: string } }>("/api/participants/me"),
            api<{ registrations: Registration[] }>("/api/me/registrations"),
            api<{ teams: Team[] }>("/api/me/teams"),
        ]);
        setName(p.participant.Name);
        setRegistrations(r.registrations);
        setTeams(t.teams);
    }, []);

    useEffect(() => {
        if (user) load().catch((e: Error) => setError(e.message));
    }, [user, load]);

    async function cancel(r: Registration) {
        if (!confirm(`Cancel your registration for ${r.Event_Name}?`)) return;
        setError("");
        setMessage("");
        try {
            await api(`/api/registrations/${r.Registration_ID}`, { method: "DELETE" });
            setMessage("Registration cancelled.");
            load();
            setRecKey((k) => k + 1);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    if (loading || !user) {
        return <main className="page-container">Loading dashboard...</main>;
    }

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Hi {name || user.email} 👋</h1>
                    <p className="fh-muted">Your registrations, teams and recommended events.</p>
                </div>
                <div className="fh-actions">
                    <Link href="/events" className="fh-btn">Browse events</Link>
                    <Link href={TEAMS_PAGE} className="fh-btn fh-btn-secondary">My teams</Link>
                </div>
            </div>

            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>My registrations</h2>
                <div className="fh-table-wrap">
                    <table className="fh-table">
                        <thead><tr><th>Event</th><th>When</th><th>As</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                            {registrations.map((r) => (
                                <tr key={r.Registration_ID}>
                                    <td><Link href={`/events/${r.Event_ID}`}>{r.Event_Name}</Link></td>
                                    <td>{formatDateTime(r.Start_Time)}<div className="fh-muted">{r.Venue_Name}</div></td>
                                    <td>{r.Joined_As === "Team" ? `Team ${r.Team_Name}` : "Individual"}</td>
                                    <td><span className={statusClass(r.Status)}>{r.Status}</span></td>
                                    <td>
                                        {r.Status !== "Cancelled" && (
                                            <button className="fh-btn fh-btn-danger fh-btn-small" onClick={() => cancel(r)}>Cancel</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {registrations.length === 0 && (
                                <tr><td colSpan={5} className="fh-muted">No registrations yet. <Link href="/events">Find an event →</Link></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="fh-card">
                <h2>My teams</h2>
                <table className="fh-table">
                    <thead><tr><th>Team</th><th>Event</th><th>Members</th><th>Registered?</th></tr></thead>
                    <tbody>
                        {teams.map((t) => (
                            <tr key={t.Team_ID}>
                                <td>{t.Team_Name}</td>
                                <td><Link href={`/events/${t.Event_ID}`}>{t.Event_Name}</Link></td>
                                <td>{t.Members}<div className="fh-muted">{t.Member_Names}</div></td>
                                <td>{t.Registration_Status ? <span className={statusClass(t.Registration_Status)}>{t.Registration_Status}</span> : "Not yet"}</td>
                            </tr>
                        ))}
                        {teams.length === 0 && (
                            <tr><td colSpan={4} className="fh-muted">You are not in a team yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </section>

            <Recommendations key={recKey} />

            <InterestsPicker onSaved={() => setRecKey((k) => k + 1)} />
        </main>
    );
}
