"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import "@/components/fh.css";

type Row = {
    Organizer_ID: number;
    Name: string;
    Club: string | null;
    Email: string;
    User_ID: number | null;
    Username: string | null;
};

const empty = { organizerId: "", name: "", club: "", phone: "", email: "", username: "", password: "" };

// Admin creates ORGANIZER logins (sign-up can only make students).
export default function OrganizerAccountsPage() {
    const { user, loading } = useAuthUser(["ADMIN"]);
    const [list, setList] = useState<Row[]>([]);
    const [form, setForm] = useState(empty);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        const d = await api<{ organizers: Row[] }>("/api/admin/organizer-accounts");
        setList(d.organizers);
    }, []);

    useEffect(() => {
        if (user) load().catch((e: Error) => setError(e.message));
    }, [user, load]);

    function pickExisting(id: string) {
        const o = list.find((x) => String(x.Organizer_ID) === id);
        setForm({ ...form, organizerId: id, name: o?.Name ?? "", club: o?.Club ?? "", email: o?.Email ?? "" });
    }

    async function save(event: FormEvent) {
        event.preventDefault();
        setError("");
        setMessage("");
        try {
            await api("/api/admin/organizer-accounts", {
                method: "POST",
                body: form.organizerId
                    ? { organizerId: Number(form.organizerId), email: form.email, username: form.username, password: form.password }
                    : { name: form.name, club: form.club || null, phone: form.phone || null, email: form.email, username: form.username, password: form.password },
            });
            setMessage(`Organizer login "${form.username}" created.`);
            setForm(empty);
            load();
        } catch (e) {
            setError((e as Error).message);
        }
    }

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    const withoutLogin = list.filter((o) => o.User_ID === null);

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Organizer accounts</h1>
                    <p className="fh-muted">Create logins for organizers. Public sign-up only creates student accounts.</p>
                </div>
                <Link href="/admin/dashboard" className="fh-muted">← Back to dashboard</Link>
            </div>

            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>New organizer login</h2>
                <form className="fh-form" onSubmit={save}>
                    <label className="fh-full">
                        For
                        <select className="fh-select" value={form.organizerId} onChange={(e) => pickExisting(e.target.value)}>
                            <option value="">A new organizer</option>
                            {withoutLogin.map((o) => (
                                <option key={o.Organizer_ID} value={o.Organizer_ID}>{o.Name} (existing, no login yet)</option>
                            ))}
                        </select>
                    </label>
                    {!form.organizerId && (
                        <>
                            <label>Name<input className="fh-input" required value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                            <label>Club<input className="fh-input" value={form.club}
                                onChange={(e) => setForm({ ...form, club: e.target.value })} /></label>
                            <label>Phone<input className="fh-input" value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                        </>
                    )}
                    <label>Email<input className="fh-input" type="email" required value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    <label>Username<input className="fh-input" required value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
                    <label>Password<input className="fh-input" type="password" required minLength={8} value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
                    <button className="fh-btn" type="submit">Create login</button>
                </form>
            </section>

            <section className="fh-card">
                <h2>All organizers</h2>
                <table className="fh-table">
                    <thead><tr><th>Name</th><th>Club</th><th>Email</th><th>Login</th></tr></thead>
                    <tbody>
                        {list.map((o) => (
                            <tr key={o.Organizer_ID}>
                                <td>{o.Name}</td>
                                <td>{o.Club ?? "—"}</td>
                                <td>{o.Email}</td>
                                <td>{o.Username ? <span className="fh-badge fh-badge-green">{o.Username}</span> : <span className="fh-muted">none</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </main>
    );
}
