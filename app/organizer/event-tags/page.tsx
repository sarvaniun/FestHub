"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import EventPicker from "@/components/EventPicker";
import "@/components/fh.css";

type Interest = { Interest_ID: number; Interest_Name: string };

// Tag events with interests (EVENT_INTEREST). These tags drive the
// interest-based recommendations (Q19) and go into the event's embedding.
export default function EventTagsPage() {
    const { user, loading } = useAuthUser(["ADMIN", "ORGANIZER"]);
    const [eventId, setEventId] = useState("");
    const [allInterests, setAllInterests] = useState<Interest[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!eventId) return;
        setError("");
        setMessage("");
        api<{ interests: Interest[]; allInterests: Interest[] }>(`/api/events/${eventId}/interests`)
            .then((d) => {
                setAllInterests(d.allInterests);
                setSelected(new Set(d.interests.map((i) => i.Interest_ID)));
            })
            .catch((e: Error) => setError(e.message));
    }, [eventId]);

    function toggle(id: number) {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    }

    async function save() {
        setError("");
        setMessage("");
        try {
            await api(`/api/events/${eventId}/interests`, {
                method: "PUT",
                body: { interestIds: [...selected] },
            });
            setMessage("Tags saved.");
        } catch (e) {
            setError((e as Error).message);
        }
    }

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Event tags</h1>
                    <p className="fh-muted">Choose which interests each event is about.</p>
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
                    <h2>Interests</h2>
                    <div className="fh-tags" style={{ marginBottom: 18 }}>
                        {allInterests.map((i) => (
                            <label key={i.Interest_ID}
                                className={selected.has(i.Interest_ID) ? "fh-badge" : "fh-badge fh-btn-secondary"}
                                style={{ cursor: "pointer", border: "1px solid var(--border)" }}>
                                <input type="checkbox" checked={selected.has(i.Interest_ID)}
                                    onChange={() => toggle(i.Interest_ID)} style={{ marginRight: 6 }} />
                                {i.Interest_Name}
                            </label>
                        ))}
                    </div>
                    <button className="fh-btn" onClick={save}>Save tags</button>
                </section>
            )}
        </main>
    );
}
