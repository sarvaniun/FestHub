"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import "@/components/fh.css";

// Member B's team page (issue #21). Change this one line if it lives elsewhere.
const TEAMS_PAGE = "/student/teams";

type Me = { role: "STUDENT" | "ORGANIZER" | "ADMIN" } | null;
type MyReg = { Registration_ID: number; Event_ID: number; Status: string; Joined_As: string; Team_Name: string | null };
type MyTeam = { Team_ID: number; Team_Name: string; Members: number; Registration_Status: string | null };

// Register / Register team, shown on /events/[id].
export default function RegisterButton({
    eventId,
    eventType,
    seatsLeft,
    onChange,
}: {
    eventId: number;
    eventType: "Individual" | "Team";
    seatsLeft: number;
    onChange?: () => void;
}) {
    const [me, setMe] = useState<Me | undefined>(undefined);
    const [myReg, setMyReg] = useState<MyReg | null>(null);
    const [teams, setTeams] = useState<MyTeam[]>([]);
    const [teamId, setTeamId] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
            setMe(null);
            return;
        }
        const data = await res.json();
        setMe(data.user);
        if (data.user.role !== "STUDENT") return;

        const [r, t] = await Promise.all([
            api<{ registrations: MyReg[] }>("/api/me/registrations"),
            eventType === "Team"
                ? api<{ teams: MyTeam[] }>(`/api/me/teams?eventId=${eventId}`)
                : Promise.resolve({ teams: [] as MyTeam[] }),
        ]);
        setMyReg(r.registrations.find((x) => x.Event_ID === eventId && x.Status !== "Cancelled") ?? null);
        setTeams(t.teams);
        if (t.teams.length > 0) setTeamId(String(t.teams[0].Team_ID));
    }, [eventId, eventType]);

    useEffect(() => {
        load().catch((e: Error) => setError(e.message));
    }, [load]);

    async function register() {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await api("/api/registrations", {
                method: "POST",
                body: eventType === "Team" ? { eventId, teamId: Number(teamId) } : { eventId },
            });
            setMessage("Registered! The organizer will confirm it.");
            await load();
            onChange?.();
        } catch (e) {
            // e.g. "Sorry, this event is full" (procedure) or
            // "You are already registered for this event" (UNIQUE key)
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    if (me === undefined) return null;

    return (
        <section className="fh-card">
            <h2>Take part</h2>
            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            {me === null && (
                <p><Link href="/login" className="fh-btn">Log in to register</Link></p>
            )}

            {me && me.role !== "STUDENT" && (
                <p className="fh-muted">Only students can register for events.</p>
            )}

            {me?.role === "STUDENT" && myReg && (
                <p>
                    You are registered{myReg.Joined_As === "Team" ? ` with team ${myReg.Team_Name}` : ""}:{" "}
                    <span className={myReg.Status === "Confirmed" ? "fh-badge fh-badge-green" : "fh-badge fh-badge-amber"}>
                        {myReg.Status}
                    </span>{" "}
                    <Link href="/student/dashboard" className="fh-muted">Manage on your dashboard →</Link>
                </p>
            )}

            {me?.role === "STUDENT" && !myReg && eventType === "Individual" && (
                <button className="fh-btn" onClick={register} disabled={busy || seatsLeft <= 0}>
                    {seatsLeft <= 0 ? "Event full" : busy ? "Registering..." : "Register"}
                </button>
            )}

            {me?.role === "STUDENT" && !myReg && eventType === "Team" && (
                teams.length === 0 ? (
                    <p className="fh-muted">
                        This is a team event. <Link href={TEAMS_PAGE}>Create or join a team for it first →</Link>
                    </p>
                ) : (
                    <div className="fh-actions">
                        <select className="fh-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                            {teams.map((t) => (
                                <option key={t.Team_ID} value={t.Team_ID}>
                                    {t.Team_Name} ({t.Members} members)
                                </option>
                            ))}
                        </select>
                        <button className="fh-btn" onClick={register} disabled={busy || !teamId}>
                            {busy ? "Registering..." : "Register team"}
                        </button>
                    </div>
                )
            )}
        </section>
    );
}
