"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, formatDateTime } from "@/lib/api-client";
import "@/components/fh.css";

type Rec = {
    Event_ID: number;
    Event_Name: string;
    Event_Type: string;
    Start_Time: string;
    Venue_Name: string;
    Because_You_Like?: string;
    Similarity?: number;
};

// "Recommended for you" panel. Member B: drop <Recommendations /> into the
// student dashboard wherever the panel should appear.
export default function Recommendations() {
    const [recs, setRecs] = useState<Rec[]>([]);
    const [method, setMethod] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api<{ method: string; recommendations: Rec[] }>("/api/recommendations")
            .then((d) => {
                setRecs(d.recommendations);
                setMethod(d.method);
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="fh-card">
            <h2>Recommended for you</h2>
            {method && (
                <p className="fh-muted" style={{ marginBottom: 12 }}>
                    {method === "vector"
                        ? "Matched by meaning to your interests (vector search)."
                        : "Events that share your interests."}
                </p>
            )}
            {error && <div className="fh-error">{error}</div>}
            {loading ? (
                <p className="fh-muted">Loading...</p>
            ) : recs.length === 0 ? (
                <p className="fh-muted">Add some interests to get recommendations.</p>
            ) : (
                <div className="fh-grid">
                    {recs.map((r) => (
                        <Link key={r.Event_ID} href={`/events/${r.Event_ID}`} className="fh-event-card">
                            <span className="fh-badge">{r.Event_Type}</span>
                            <h3>{r.Event_Name}</h3>
                            <p className="fh-muted">{formatDateTime(r.Start_Time)} · {r.Venue_Name}</p>
                            {r.Because_You_Like && (
                                <p className="fh-muted" style={{ marginTop: 6 }}>Because you like {r.Because_You_Like}</p>
                            )}
                            {r.Similarity !== undefined && (
                                <p className="fh-muted" style={{ marginTop: 6 }}>Match {Math.round(r.Similarity * 100)}%</p>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
