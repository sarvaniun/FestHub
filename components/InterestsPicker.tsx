"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import "@/components/fh.css";

type Interest = { Interest_ID: number; Interest_Name: string };

// Student picks their interests (PARTICIPANT_INTEREST). Calls onSaved so
// the dashboard can refresh the recommendations.
export default function InterestsPicker({ onSaved }: { onSaved?: () => void }) {
    const [all, setAll] = useState<Interest[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([
            api<{ interests: Interest[] }>("/api/interests"),
            api<{ interests: Interest[] }>("/api/me/interests"),
        ])
            .then(([a, mine]) => {
                setAll(a.interests);
                setSelected(new Set(mine.interests.map((i) => i.Interest_ID)));
            })
            .catch((e: Error) => setError(e.message));
    }, []);

    function toggle(id: number) {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
        setMessage("");
    }

    async function save() {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            await api("/api/me/interests", { method: "PUT", body: { interestIds: [...selected] } });
            setMessage("Interests saved.");
            onSaved?.();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="fh-card">
            <h2>My interests</h2>
            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}
            <div className="fh-tags" style={{ marginBottom: 16 }}>
                {all.map((i) => (
                    <button
                        key={i.Interest_ID}
                        type="button"
                        onClick={() => toggle(i.Interest_ID)}
                        className={selected.has(i.Interest_ID) ? "fh-btn fh-btn-small" : "fh-btn fh-btn-secondary fh-btn-small"}
                    >
                        {selected.has(i.Interest_ID) ? "✓ " : ""}{i.Interest_Name}
                    </button>
                ))}
            </div>
            <button className="fh-btn" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save interests"}
            </button>
        </section>
    );
}
