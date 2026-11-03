"use client";

import Link from "next/link";
import EventManager from "@/components/EventManager";
import { useAuthUser } from "@/lib/useAuthUser";
import "@/components/fh.css";

export default function AdminEventsPage() {
    const { user, loading } = useAuthUser(["ADMIN"]);

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Manage events</h1>
                    <p className="fh-muted">Create, edit and delete fest events.</p>
                </div>
                <Link href="/admin/dashboard" className="fh-muted">← Back to dashboard</Link>
            </div>
            <EventManager scope="all" />
        </main>
    );
}
