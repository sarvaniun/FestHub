"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Recommendations from "@/components/Recommendations";
import { api } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import "@/components/fh.css";

type Rec = { Event_ID: number; Event_Name: string; Because_You_Like?: string; Matching_Interests?: number; Similarity?: number };

// Recommended events, plus a side-by-side comparison of the two methods
// (vector similarity vs Stage 2 Q19 interest tags) for report §15.
export default function StudentRecommendationsPage() {
    const { user, loading } = useAuthUser(["STUDENT"]);
    const [compare, setCompare] = useState<{ vector: Rec[]; interests: Rec[]; vectorAvailable: boolean } | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) return;
        api<{ vector: Rec[]; interests: Rec[]; vectorAvailable: boolean }>("/api/recommendations?compare=1")
            .then(setCompare)
            .catch((e: Error) => setError(e.message));
    }, [user]);

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    return (
        <main className="page-container">
            <div className="fh-header">
                <h1>Recommended events</h1>
                <Link href="/student/dashboard" className="fh-muted">← Back to dashboard</Link>
            </div>

            <Recommendations />

            {error && <div className="fh-error">{error}</div>}

            {compare && (
                <div className="fh-two-col">
                    <section className="fh-card">
                        <h2>By meaning (pgvector)</h2>
                        {!compare.vectorAvailable && (
                            <p className="fh-muted">Vector search is not available (no interests, or no embeddings yet).</p>
                        )}
                        <table className="fh-table">
                            <thead><tr><th>#</th><th>Event</th><th>Similarity</th></tr></thead>
                            <tbody>
                                {compare.vector.map((r, i) => (
                                    <tr key={r.Event_ID}><td>{i + 1}</td><td>{r.Event_Name}</td><td>{r.Similarity?.toFixed(3)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    <section className="fh-card">
                        <h2>By shared tags (SQL Q19)</h2>
                        <table className="fh-table">
                            <thead><tr><th>#</th><th>Event</th><th>Matching tags</th></tr></thead>
                            <tbody>
                                {compare.interests.map((r, i) => (
                                    <tr key={r.Event_ID}>
                                        <td>{i + 1}</td>
                                        <td>{r.Event_Name}</td>
                                        <td>{r.Matching_Interests} <span className="fh-muted">({r.Because_You_Like})</span></td>
                                    </tr>
                                ))}
                                {compare.interests.length === 0 && (
                                    <tr><td colSpan={3} className="fh-muted">No events share your interest tags.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                </div>
            )}
        </main>
    );
}
