"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, formatDateTime } from "@/lib/api-client";
import type { EventSummary, VenueOption } from "@/lib/types";
import "@/components/fh.css";

type Filters = { q: string; type: string; date: string; venue: string };

const noFilters: Filters = { q: "", type: "", date: "", venue: "" };

export default function EventsPage() {
    const router = useRouter();
    const [events, setEvents] = useState<EventSummary[]>([]);
    const [venues, setVenues] = useState<VenueOption[]>([]);
    const [draft, setDraft] = useState<Filters>(noFilters);
    const [filters, setFilters] = useState<Filters>(noFilters);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api<{ venues: VenueOption[] }>("/api/venues")
            .then((d) => setVenues(d.venues))
            .catch(() => setVenues([]));
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
            if (value) params.set(key, value);
        }
        let cancelled = false;
        setLoading(true);
        setError("");
        api<{ events: EventSummary[] }>(`/api/events?${params.toString()}`)
            .then((d) => { if (!cancelled) setEvents(d.events); })
            .catch((e: Error) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [filters]);

    function apply(event: FormEvent) {
        event.preventDefault();
        setFilters(draft);
    }

    function searchByMeaning() {
        if (draft.q.trim()) {
            router.push(`/search?q=${encodeURIComponent(draft.q.trim())}`);
        } else {
            router.push("/search");
        }
    }

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Events</h1>
                    <p className="fh-muted">Browse every event in the fest.</p>
                </div>
            </div>

            <form className="fh-filters" onSubmit={apply}>
                <input
                    className="fh-input"
                    placeholder="Search name or description"
                    value={draft.q}
                    onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                    style={{ flex: "1 1 220px" }}
                />
                <select className="fh-select" value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                    <option value="">Any type</option>
                    <option value="Individual">Individual</option>
                    <option value="Team">Team</option>
                </select>
                <input className="fh-input" type="date" value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                <select className="fh-select" value={draft.venue}
                    onChange={(e) => setDraft({ ...draft, venue: e.target.value })}>
                    <option value="">Any venue</option>
                    {venues.map((v) => (
                        <option key={v.Venue_ID} value={v.Venue_ID}>{v.Venue_Name}</option>
                    ))}
                </select>
                <button className="fh-btn" type="submit">Filter</button>
                <button className="fh-btn fh-btn-secondary" type="button"
                    onClick={() => { setDraft(noFilters); setFilters(noFilters); }}>
                    Clear
                </button>
                <button className="fh-btn fh-btn-secondary" type="button" onClick={searchByMeaning}>
                    Search by meaning ✨
                </button>
            </form>

            {error && <div className="fh-error">{error}</div>}

            {loading ? (
                <p className="fh-muted">Loading events...</p>
            ) : events.length === 0 ? (
                <div className="fh-card"><p className="fh-muted">No events found.</p></div>
            ) : (
                <div className="fh-grid">
                    {events.map((e) => (
                        <Link key={e.Event_ID} href={`/events/${e.Event_ID}`} className="fh-event-card">
                            <span className="fh-badge">{e.Event_Type}</span>
                            <h3>{e.Event_Name}</h3>
                            <p className="fh-muted">{formatDateTime(e.Start_Time)}</p>
                            <p className="fh-muted">{e.Venue_Name}</p>
                            <p style={{ marginTop: 10, fontSize: 14 }}>
                                {e.Seats_Left > 0 ? (
                                    <span className="fh-badge fh-badge-green">{e.Seats_Left} seats left</span>
                                ) : (
                                    <span className="fh-badge fh-badge-red">Full</span>
                                )}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
