"use client";

import Link from "next/link";
import EventManager from "@/components/EventManager";
import { useAuthUser } from "@/lib/useAuthUser";
import "@/components/fh.css";

export default function OrganizerEventsPage() {
    const { user, loading } = useAuthUser(["ORGANIZER"]);

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>My events</h1>
                    <p className="fh-muted">Create events and edit the ones you organize.</p>
                </div>
                <Link href="/organizer/dashboard" className="fh-muted">← Back to dashboard</Link>
            </div>
            <EventManager scope="mine" />
        </main>
    );
}
