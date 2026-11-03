"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import EventPicker from "@/components/EventPicker";
import "@/components/fh.css";

type Registration = { Registration_ID: number; Registered_By: string; Kind: string; Status: string };
type Judge = { Judge_ID: number; Name: string };
type Score = { Judge_ID: number; Judge: string; Registration_ID: number; Registered_By: string; Score: string; Remarks: string | null };
type Missing = { Judge_ID: number; Judge: string; Registration_ID: number; Registered_By: string };

const emptyForm = { registrationId: "", judgeId: "", score: "", remarks: "" };

// Organizers (and admins) enter judges' scores for an event.
export default function ScoresPage() {
    const { user, loading } = useAuthUser(["ADMIN", "ORGANIZER"]);
    const [eventId, setEventId] = useState("");
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [eventJudges, setEventJudges] = useState<Judge[]>([]);
    const [allJudges, setAllJudges] = useState<Judge[]>([]);
    const [showAllJudges, setShowAllJudges] = useState(false);
    const [scores, setScores] = useState<Score[]>([]);
    const [missing, setMissing] = useState<Missing[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async (id: string) => {
        if (!id) return;
        const [r, j, s, m, all] = await Promise.all([
            api<{ registrations: Registration[] }>(`/api/events/${id}/registrations`),
            api<{ judges: Judge[] }>(`/api/events/${id}/judges`),
            api<{ scores: Score[] }>(`/api/events/${id}/scores`),
            api<{ missing: Missing[] }>(`/api/events/${id}/missing-scores`),
            api<{ judges: Judge[] }>("/api/judges"),
        ]);
        setRegistrations(r.registrations.filter((x) => x.Status !== "Cancelled"));
        setEventJudges(j.judges);
        setScores(s.scores);
        setMissing(m.missing);
        setAllJudges(all.judges);
    }, []);

    useEffect(() => {
        setForm(emptyForm);
        setEditing(false);
        load(eventId).catch((e: Error) => setError(e.message));
    }, [eventId, load]);

    async function save(event: FormEvent) {
        event.preventDefault();
        setError("");
        setMessage("");
        try {
            await api("/api/scores", {
                method: editing ? "PUT" : "POST",
                body: {
                    registrationId: Number(form.registrationId),
                    judgeId: Number(form.judgeId),
                    score: Number(form.score),
                    remarks: form.remarks || null,
                },
            });
            setMessage(editing ? "Score updated." : "Score saved.");
            setForm(emptyForm);
            setEditing(false);
            load(eventId);
        } catch (e) {
            // e.g. "This judge is not assigned to this event (rejected by foreign key ...)"
            setError((e as Error).message);
        }
    }

    function startEdit(s: Score) {
        setEditing(true);
        setForm({
            registrationId: String(s.Registration_ID),
            judgeId: String(s.Judge_ID),
            score: String(Number(s.Score)),
            remarks: s.Remarks ?? "",
        });
    }

    function fillMissing(m: Missing) {
        setEditing(false);
        setForm({ ...emptyForm, registrationId: String(m.Registration_ID), judgeId: String(m.Judge_ID) });
    }

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    const judgeOptions = showAllJudges ? allJudges : eventJudges;
    const backHref = user.role === "ADMIN" ? "/admin/dashboard" : "/organizer/dashboard";

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Enter scores</h1>
                    <p className="fh-muted">Record each judge&apos;s score (0–100) for a registration.</p>
                </div>
                <Link href={backHref} className="fh-muted">← Back to dashboard</Link>
            </div>

            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>Event</h2>
                <EventPicker role={user.role === "ADMIN" ? "ADMIN" : "ORGANIZER"} value={eventId} onChange={setEventId} />
                {eventId && (
                    <p style={{ marginTop: 12 }}>
                        <Link href={`/events/${eventId}/leaderboard`} className="fh-badge">View leaderboard →</Link>
                    </p>
                )}
            </section>

            {eventId && (
                <>
                    <section className="fh-card">
                        <h2>{editing ? "Edit score" : "New score"}</h2>
                        <form className="fh-form" onSubmit={save}>
                            <label>
                                Registration
                                <select className="fh-select" required disabled={editing} value={form.registrationId}
                                    onChange={(e) => setForm({ ...form, registrationId: e.target.value })}>
                                    <option value="">Choose</option>
                                    {registrations.map((r) => (
                                        <option key={r.Registration_ID} value={r.Registration_ID}>
                                            #{r.Registration_ID} {r.Registered_By} ({r.Status})
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Judge
                                <select className="fh-select" required disabled={editing} value={form.judgeId}
                                    onChange={(e) => setForm({ ...form, judgeId: e.target.value })}>
                                    <option value="">Choose</option>
                                    {judgeOptions.map((j) => (
                                        <option key={j.Judge_ID} value={j.Judge_ID}>{j.Name}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Score
                                <input className="fh-input" type="number" min={0} max={100} step="0.01" required
                                    value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
                            </label>
                            <label>
                                Remarks
                                <input className="fh-input" value={form.remarks}
                                    onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                            </label>
                            <div className="fh-actions">
                                <button className="fh-btn" type="submit">{editing ? "Save" : "Add score"}</button>
                                {editing && (
                                    <button className="fh-btn fh-btn-secondary" type="button"
                                        onClick={() => { setEditing(false); setForm(emptyForm); }}>Cancel</button>
                                )}
                            </div>
                        </form>
                        <label className="fh-muted" style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
                            <input type="checkbox" checked={showAllJudges}
                                onChange={(e) => setShowAllJudges(e.target.checked)} />
                            Show all judges, not just this event&apos;s (to demo the foreign key rejecting a wrong judge)
                        </label>
                    </section>

                    <div className="fh-two-col">
                        <section className="fh-card">
                            <h2>Scores given</h2>
                            <table className="fh-table">
                                <thead><tr><th>Registration</th><th>Judge</th><th>Score</th><th></th></tr></thead>
                                <tbody>
                                    {scores.map((s) => (
                                        <tr key={`${s.Judge_ID}-${s.Registration_ID}`}>
                                            <td>{s.Registered_By}</td>
                                            <td>{s.Judge}</td>
                                            <td>{Number(s.Score)}</td>
                                            <td><button className="fh-btn fh-btn-secondary fh-btn-small" onClick={() => startEdit(s)}>Edit</button></td>
                                        </tr>
                                    ))}
                                    {scores.length === 0 && <tr><td colSpan={4} className="fh-muted">No scores yet.</td></tr>}
                                </tbody>
                            </table>
                        </section>

                        <section className="fh-card">
                            <h2>Still missing</h2>
                            <p className="fh-muted" style={{ marginBottom: 10 }}>Assigned judge × confirmed registration with no score.</p>
                            <table className="fh-table">
                                <thead><tr><th>Judge</th><th>Registration</th><th></th></tr></thead>
                                <tbody>
                                    {missing.map((m) => (
                                        <tr key={`${m.Judge_ID}-${m.Registration_ID}`}>
                                            <td>{m.Judge}</td>
                                            <td>{m.Registered_By}</td>
                                            <td><button className="fh-btn fh-btn-secondary fh-btn-small" onClick={() => fillMissing(m)}>Score</button></td>
                                        </tr>
                                    ))}
                                    {missing.length === 0 && <tr><td colSpan={3} className="fh-muted">Nothing missing.</td></tr>}
                                </tbody>
                            </table>
                        </section>
                    </div>
                </>
            )}
        </main>
    );
}
