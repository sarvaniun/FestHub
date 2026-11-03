"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import "@/components/fh.css";

type Row = {
    Registration_ID: number;
    Registered_By: string;
    Average_Score: number;
    Judges: number;
    Leaderboard_Rank: number;
};

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "");

export default function LeaderboardPage() {
    const { id } = useParams<{ id: string }>();
    const [eventName, setEventName] = useState("");
    const [rowsData, setRowsData] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api<{ event: { Event_Name: string }; leaderboard: Row[] }>(`/api/events/${id}/leaderboard`)
            .then((d) => {
                setEventName(d.event.Event_Name);
                setRowsData(d.leaderboard);
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    return (
        <main className="page-container">
            <Link href={`/events/${id}`} className="fh-muted">← Back to event</Link>
            <h1 style={{ margin: "14px 0 6px" }}>Leaderboard{eventName ? `: ${eventName}` : ""}</h1>
            <p className="fh-muted" style={{ marginBottom: 20 }}>
                Average judge score per registration, ranked with RANK() (ties share a rank).
            </p>

            {error && <div className="fh-error">{error}</div>}

            <section className="fh-card">
                {loading ? (
                    <p className="fh-muted">Loading...</p>
                ) : rowsData.length === 0 ? (
                    <p className="fh-muted">No scores yet.</p>
                ) : (
                    <table className="fh-table">
                        <thead><tr><th>Rank</th><th>Name / Team</th><th>Average score</th><th>Judges</th></tr></thead>
                        <tbody>
                            {rowsData.map((r) => (
                                <tr key={r.Registration_ID}>
                                    <td><strong>{medal(r.Leaderboard_Rank)} {r.Leaderboard_Rank}</strong></td>
                                    <td>{r.Registered_By}</td>
                                    <td>{r.Average_Score}</td>
                                    <td>{r.Judges}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </main>
    );
}
