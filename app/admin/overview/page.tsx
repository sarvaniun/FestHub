"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, formatDateTime, formatRupees } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import BudgetBadge from "@/components/BudgetBadge";
import ReindexButton from "@/components/ReindexButton";
import "@/components/fh.css";

type Readiness = { Event_ID: number; Event_Name: string; Organizers: number; Judges: number; Registrations: number; Readiness: string };
type Clash = { Venue_Name: string; Event_A: string; Event_B: string; Overlap_From: string; Overlap_To: string };
type Fill = { Event_ID: number; Event_Name: string; Venue_Name: string; Capacity: number; Seats_Taken: string; Fill_Percent: string; Seat_Status: string };
type Budget = { Event_ID: number; Event_Name: string; Budget: string; Spent: string; Remaining: string; Utilisation_Percent: string | null; Budget_Status: string };

export default function AdminOverviewPage() {
    const { user, loading } = useAuthUser(["ADMIN"]);
    const [readiness, setReadiness] = useState<Readiness[]>([]);
    const [clashes, setClashes] = useState<Clash[]>([]);
    const [fill, setFill] = useState<Fill[]>([]);
    const [budget, setBudget] = useState<Budget[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) return;
        Promise.all([
            api<{ readiness: Readiness[] }>("/api/reports/readiness"),
            api<{ clashes: Clash[] }>("/api/reports/venue-clashes"),
            api<{ fillRate: Fill[] }>("/api/reports/fill-rate"),
            api<{ budget: Budget[] }>("/api/budget"),
        ])
            .then(([r, c, f, b]) => {
                setReadiness(r.readiness);
                setClashes(c.clashes);
                setFill(f.fillRate);
                setBudget(b.budget);
            })
            .catch((e: Error) => setError(e.message));
    }, [user]);

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    const ready = readiness.filter((r) => r.Readiness === "Ready").length;
    const totalBudget = budget.reduce((sum, b) => sum + Number(b.Budget), 0);
    const totalSpent = budget.reduce((sum, b) => sum + Number(b.Spent), 0);

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Fest overview</h1>
                    <p className="fh-muted">Readiness, venue clashes, seat fill rate and budget across all events.</p>
                </div>
                <Link href="/admin/dashboard" className="fh-muted">← Back to dashboard</Link>
            </div>

            {error && <div className="fh-error">{error}</div>}

            <div className="fh-grid" style={{ marginBottom: 20 }}>
                <div className="fh-card"><p className="fh-muted">Events ready</p><h2>{ready} / {readiness.length}</h2></div>
                <div className="fh-card"><p className="fh-muted">Venue clashes</p><h2>{clashes.length}</h2></div>
                <div className="fh-card"><p className="fh-muted">Total budget</p><h2>{formatRupees(totalBudget)}</h2></div>
                <div className="fh-card"><p className="fh-muted">Total spent</p><h2>{formatRupees(totalSpent)}</h2></div>
            </div>

            <section className="fh-card">
                <h2>Readiness (V_EVENT_READINESS)</h2>
                <div className="fh-table-wrap">
                    <table className="fh-table">
                        <thead><tr><th>Event</th><th>Organizers</th><th>Judges</th><th>Registrations</th><th>Status</th></tr></thead>
                        <tbody>
                            {readiness.map((r) => (
                                <tr key={r.Event_ID}>
                                    <td><Link href={`/events/${r.Event_ID}`}>{r.Event_Name}</Link></td>
                                    <td>{r.Organizers}</td>
                                    <td>{r.Judges}</td>
                                    <td>{r.Registrations}</td>
                                    <td>
                                        <span className={r.Readiness === "Ready" ? "fh-badge fh-badge-green" : "fh-badge fh-badge-amber"}>
                                            {r.Readiness}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="fh-card">
                <h2>Venue clashes</h2>
                {clashes.length === 0 ? (
                    <p className="fh-muted">No overlapping events in any venue.</p>
                ) : (
                    <table className="fh-table">
                        <thead><tr><th>Venue</th><th>Event A</th><th>Event B</th><th>Overlap</th></tr></thead>
                        <tbody>
                            {clashes.map((c, i) => (
                                <tr key={i}>
                                    <td>{c.Venue_Name}</td>
                                    <td>{c.Event_A}</td>
                                    <td>{c.Event_B}</td>
                                    <td>{formatDateTime(c.Overlap_From)} – {formatDateTime(c.Overlap_To)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="fh-card">
                <h2>Seat fill rate</h2>
                <div className="fh-table-wrap">
                    <table className="fh-table">
                        <thead><tr><th>Event</th><th>Venue</th><th>Seats</th><th>Fill</th><th>Status</th></tr></thead>
                        <tbody>
                            {fill.map((f) => (
                                <tr key={f.Event_ID}>
                                    <td>{f.Event_Name}</td>
                                    <td>{f.Venue_Name}</td>
                                    <td>{Number(f.Seats_Taken)} / {f.Capacity}</td>
                                    <td>{f.Fill_Percent}%</td>
                                    <td>
                                        <span className={f.Seat_Status === "Seats available" ? "fh-badge fh-badge-green" : f.Seat_Status === "Full" ? "fh-badge fh-badge-red" : "fh-badge fh-badge-amber"}>
                                            {f.Seat_Status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="fh-card">
                <h2>Budget status (V_BUDGET_STATUS)</h2>
                <div className="fh-table-wrap">
                    <table className="fh-table">
                        <thead><tr><th>Event</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Used</th><th>Status</th></tr></thead>
                        <tbody>
                            {budget.map((b) => (
                                <tr key={b.Event_ID}>
                                    <td>{b.Event_Name}</td>
                                    <td>{formatRupees(b.Budget)}</td>
                                    <td>{formatRupees(b.Spent)}</td>
                                    <td>{formatRupees(b.Remaining)}</td>
                                    <td>{b.Utilisation_Percent ?? "—"}%</td>
                                    <td><BudgetBadge status={b.Budget_Status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <ReindexButton />
        </main>
    );
}
