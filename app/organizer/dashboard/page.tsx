
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OrganizerDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");

    useEffect(() => {
        async function checkSession() {
            try {
                const response = await fetch("/api/auth/me");

                if (!response.ok) {
                    router.replace("/login");
                    return;
                }

                const data = await response.json();

                if (data.user.role !== "ORGANIZER") {
                    router.replace("/login");
                    return;
                }

                setEmail(data.user.email);
            } catch {
                router.replace("/login");
            } finally {
                setLoading(false);
            }
        }

        checkSession();
    }, [router]);

    if (loading) {
        return <main className="page-container">Loading dashboard...</main>;
    }

    return (
        <main className="page-container">
            <h1>Organizer Dashboard</h1>
            <p style={{ color: "var(--muted)", marginTop: 12 }}>
                Welcome, {email}!
            </p>

            <section style={{
                marginTop: 35,
                padding: 28,
                background: "white",
                border: "1px solid var(--border)",
                borderRadius: 12
            }}>
                <h2>Manage Your Events</h2>
                <p style={{ color: "var(--muted)", marginTop: 12 }}>
                    View your events and manage participant registrations.
                    Your event management tools will appear here.
                </p>
            </section>
        </main>
    );
}
