"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, formatDateTime } from "@/lib/api-client";
import "@/components/fh.css";

type Result = {
    Event_ID: number;
    Event_Name: string;
    Event_Type: string;
    Start_Time: string;
    Venue_Name: string;
    Description: string | null;
    Similarity: number;
};

const EXAMPLES = ["something with robots", "music night", "coding competition for beginners", "public speaking"];

function SearchInner() {
    const router = useRouter();
    const params = useSearchParams();
    const initial = params.get("q") ?? "";
    const [query, setQuery] = useState(initial);
    const [results, setResults] = useState<Result[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const run = useCallback(async (q: string) => {
        if (q.trim().length < 2) return;
        setBusy(true);
        setError("");
        try {
            const d = await api<{ results: Result[] }>("/api/search", { method: "POST", body: { query: q } });
            setResults(d.results);
        } catch (e) {
            setError((e as Error).message);
            setResults(null);
        } finally {
            setBusy(false);
        }
    }, []);

    useEffect(() => {
        if (initial) run(initial);
    }, [initial, run]);

    // Putting the query in the URL (?q=...) re-runs the effect above, so
    // the search can be shared/bookmarked. Same query again → run directly.
    function searchFor(q: string) {
        const text = q.trim();
        if (text === initial) run(text);
        else router.replace(`/search?q=${encodeURIComponent(text)}`);
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        searchFor(query);
    }

    return (
        <main className="page-container">
            <Link href="/events" className="fh-muted">← All events</Link>
            <h1 style={{ margin: "14px 0 6px" }}>Search by meaning</h1>
            <p className="fh-muted" style={{ marginBottom: 20 }}>
                Describe what you are looking for in your own words. Events are matched by meaning
                (all-MiniLM-L6-v2 embeddings + pgvector), not by exact keywords.
            </p>

            <form className="fh-filters" onSubmit={submit}>
                <input className="fh-input" style={{ flex: "1 1 300px" }} value={query}
                    placeholder="e.g. something with robots" onChange={(e) => setQuery(e.target.value)} />
                <button className="fh-btn" type="submit" disabled={busy}>{busy ? "Searching..." : "Search"}</button>
            </form>
            <div className="fh-tags" style={{ marginBottom: 20 }}>
                {EXAMPLES.map((ex) => (
                    <button key={ex} className="fh-badge" style={{ border: "none", cursor: "pointer" }}
                        onClick={() => { setQuery(ex); searchFor(ex); }}>
                        {ex}
                    </button>
                ))}
            </div>

            {error && <div className="fh-error">{error}</div>}

            {results && (
                results.length === 0 ? (
                    <div className="fh-card"><p className="fh-muted">No events found. Has the admin run “Re-embed all events”?</p></div>
                ) : (
                    <section className="fh-card">
                        <h2>Top {results.length} matches</h2>
                        <table className="fh-table">
                            <thead><tr><th>#</th><th>Event</th><th>When</th><th>Similarity</th></tr></thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={r.Event_ID}>
                                        <td>{i + 1}</td>
                                        <td>
                                            <Link href={`/events/${r.Event_ID}`}><strong>{r.Event_Name}</strong></Link>
                                            <div className="fh-muted">{r.Description}</div>
                                        </td>
                                        <td>{formatDateTime(r.Start_Time)}<div className="fh-muted">{r.Venue_Name}</div></td>
                                        <td><span className="fh-badge">{r.Similarity.toFixed(3)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )
            )}
        </main>
    );
}

// useSearchParams needs a Suspense boundary in the App Router.
export default function SearchPage() {
    return (
        <Suspense fallback={<main className="page-container">Loading...</main>}>
            <SearchInner />
        </Suspense>
    );
}
