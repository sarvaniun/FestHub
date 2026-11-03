"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, formatDateTime } from "@/lib/api-client";
import type { EventDetails } from "@/lib/types";
import RegisterButton from "@/components/RegisterButton";
import "@/components/fh.css";

export default function EventDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0); // bumped after registering, to refresh seats

    useEffect(() => {
        let cancelled = false;
        api<{ event: EventDetails }>(`/api/events/${id}`)
            .then((d) => { if (!cancelled) setEvent(d.event); })
            .catch((e: Error) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [id, reload]);

    if (loading) {
        return <main className="page-container">Loading event...</main>;
    }

    if (error || !event) {
        return (
            <main className="page-container">
                <div className="fh-error">{error || "Event not found"}</div>
                <Link href="/events">← All events</Link>
            </main>
        );
    }

    return (
        <main className="page-container">
            <Link href="/events" className="fh-muted">← All events</Link>

            <div className="fh-header" style={{ marginTop: 14 }}>
                <div>
                    <span className="fh-badge">{event.Event_Type}</span>
                    <h1 style={{ marginTop: 8 }}>{event.Event_Name}</h1>
                </div>
                <Link href={`/events/${event.Event_ID}/leaderboard`} className="fh-btn fh-btn-secondary">
                    Leaderboard
                </Link>
            </div>

            <div className="fh-two-col">
                <section className="fh-card">
                    <h2>About</h2>
                    <p style={{ marginBottom: 18 }}>{event.Description || "No description yet."}</p>
                    <dl className="fh-dl">
                        <dt>Starts</dt><dd>{formatDateTime(event.Start_Time)}</dd>
                        <dt>Ends</dt><dd>{formatDateTime(event.End_Time)}</dd>
                        <dt>Venue</dt>
                        <dd>{event.Venue_Name}{event.Location ? `, ${event.Location}` : ""}</dd>
                        <dt>Seats</dt>
                        <dd>
                            {event.Seats_Taken} taken of {event.Capacity} ·{" "}
                            {event.Seats_Left > 0 ? (
                                <span className="fh-badge fh-badge-green">{event.Seats_Left} left</span>
                            ) : (
                                <span className="fh-badge fh-badge-red">Full</span>
                            )}
                        </dd>
                    </dl>

                    {event.tags.length > 0 && (
                        <div className="fh-tags" style={{ marginTop: 18 }}>
                            {event.tags.map((t) => (
                                <span key={t.Interest_ID} className="fh-badge">{t.Interest_Name}</span>
                            ))}
                        </div>
                    )}
                </section>

                <section className="fh-card">
                    <h2>Organizers</h2>
                    {event.organizers.length === 0 ? (
                        <p className="fh-muted">None assigned yet.</p>
                    ) : (
                        <ul style={{ paddingLeft: 18, marginBottom: 20 }}>
                            {event.organizers.map((o) => (
                                <li key={o.Organizer_ID}>{o.Name}{o.Club ? ` (${o.Club})` : ""}</li>
                            ))}
                        </ul>
                    )}

                    <h2>Judges</h2>
                    {event.judges.length === 0 ? (
                        <p className="fh-muted">None assigned yet.</p>
                    ) : (
                        <ul style={{ paddingLeft: 18 }}>
                            {event.judges.map((j) => (
                                <li key={j.Judge_ID}>{j.Name}{j.Expertise ? ` – ${j.Expertise}` : ""}</li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <RegisterButton
                eventId={event.Event_ID}
                eventType={event.Event_Type}
                seatsLeft={event.Seats_Left}
                onChange={() => setReload((r) => r + 1)}
            />
        </main>
    );
}
