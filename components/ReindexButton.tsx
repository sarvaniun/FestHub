"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import "@/components/fh.css";

// Admin button: (re)build every event's embedding in pgvector.
export default function ReindexButton() {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState("");
    const [error, setError] = useState("");

    async function run() {
        setBusy(true);
        setResult("");
        setError("");
        try {
            const d = await api<{ embedded: number; removed: number }>("/api/vector/reindex", { method: "POST" });
            setResult(`Embedded ${d.embedded} events, removed ${d.removed} stale vectors.`);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="fh-card">
            <h2>Vector search</h2>
            <p className="fh-muted" style={{ marginBottom: 12 }}>
                Rebuild the pgvector embeddings of all events. The first run downloads the model and can take a minute.
            </p>
            {error && <div className="fh-error">{error}</div>}
            {result && <div className="fh-success">{result}</div>}
            <button className="fh-btn" onClick={run} disabled={busy}>
                {busy ? "Embedding..." : "Re-embed all events"}
            </button>
        </section>
    );
}
