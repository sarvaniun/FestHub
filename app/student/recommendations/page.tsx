"use client";

import Link from "next/link";
import Recommendations from "@/components/Recommendations";
import { useAuthUser } from "@/lib/useAuthUser";
import "@/components/fh.css";

export default function StudentRecommendationsPage() {
    const { user, loading } = useAuthUser(["STUDENT"]);

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
        </main>
    );
}
