"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

async function api<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
): Promise<T> {
    const response = await fetch(path, {
        method: options.method ?? "GET",
        credentials: "same-origin",
        headers: options.body
            ? { "Content-Type": "application/json" }
            : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.error ?? data?.message ?? `Request failed (${response.status})`
        );
    }

    return data as T;
}

type EventItem = {
    Event_ID?: number;
    Event_Name?: string;
    Event_Type?: string;
    eventId?: number;
    eventName?: string;
    eventType?: string;
};

type TeamMember = {
    Participant_ID?: number;
    Participant_Name?: string;
    Name?: string;
    participantId?: number;
    participantName?: string;
    name?: string;
};

type Team = {
    Team_ID?: number;
    Team_Name?: string;
    Event_ID?: number;
    Event_Name?: string;
    teamId?: number;
    teamName?: string;
    eventId?: number;
    eventName?: string;
    members?: TeamMember[];
    Participants?: TeamMember[];
    memberCount?: number;
    Members_Count?: number;
    isRegistered?: boolean;
};

function teamIdOf(team: Team) {
    return team.Team_ID ?? team.teamId ?? 0;
}

function teamNameOf(team: Team) {
    return team.Team_Name ?? team.teamName ?? "Unnamed team";
}

function eventIdOf(event: EventItem) {
    return event.Event_ID ?? event.eventId ?? 0;
}

function eventNameOf(event: EventItem) {
    return event.Event_Name ?? event.eventName ?? "Unnamed event";
}

function memberIdOf(member: TeamMember) {
    return member.Participant_ID ?? member.participantId ?? 0;
}

function memberNameOf(member: TeamMember) {
    return (
        member.Participant_Name ??
        member.participantName ??
        member.Name ??
        member.name ??
        `Participant ${memberIdOf(member)}`
    );
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

    const [eventId, setEventId] = useState("");
    const [teamName, setTeamName] = useState("");
    const [renameValue, setRenameValue] = useState("");
    const [participantId, setParticipantId] = useState("");

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const selectedTeam =
        teams.find((team) => teamIdOf(team) === selectedTeamId) ?? null;

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [teamResponse, eventResponse] = await Promise.all([
                api<{ teams: Team[] }>("/api/me/teams"),
                api<{ events: EventItem[] }>("/api/events?type=Team"),
            ]);

            setTeams(teamResponse.teams ?? []);
            setEvents(eventResponse.events ?? []);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not load your teams."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    async function createTeam() {
        setError("");
        setMessage("");

        if (!eventId || !teamName.trim()) {
            setError("Choose an event and enter a team name.");
            return;
        }

        setBusy(true);

        try {
            await api("/api/teams", {
                method: "POST",
                body: {
                    eventId: Number(eventId),
                    teamName: teamName.trim(),
                },
            });

            setTeamName("");
            setEventId("");
            setMessage("Team created successfully.");
            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Could not create team."
            );
        } finally {
            setBusy(false);
        }
    }

    async function renameTeam() {
        if (!selectedTeam || !renameValue.trim()) {
            setError("Enter a new team name.");
            return;
        }

        setError("");
        setMessage("");
        setBusy(true);

        try {
            await api(`/api/teams/${teamIdOf(selectedTeam)}`, {
                method: "PUT",
                body: { teamName: renameValue.trim() },
            });

            setRenameValue("");
            setMessage("Team name updated.");
            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Could not rename team."
            );
        } finally {
            setBusy(false);
        }
    }

    async function addMember() {
        if (!selectedTeam || !participantId.trim()) {
            setError("Enter the participant ID to add.");
            return;
        }

        const parsedId = Number(participantId);

        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            setError("Participant ID must be a positive integer.");
            return;
        }

        setError("");
        setMessage("");
        setBusy(true);

        try {
            await api(
                `/api/teams/${teamIdOf(selectedTeam)}/participants`,
                {
                    method: "POST",
                    body: { participantId: parsedId },
                }
            );

            setParticipantId("");
            setMessage("Participant added to the team.");
            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Could not add participant."
            );
        } finally {
            setBusy(false);
        }
    }

    async function removeMember(memberId: number) {
        if (!selectedTeam) return;

        const confirmed = window.confirm(
            "Are you sure you want to remove this participant?"
        );

        if (!confirmed) return;

        setError("");
        setMessage("");
        setBusy(true);

        try {
            await api(
                `/api/teams/${teamIdOf(selectedTeam)}/participants/${memberId}`,
                { method: "DELETE" }
            );

            setMessage("Participant removed.");
            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Could not remove participant."
            );
        } finally {
            setBusy(false);
        }
    }

    async function deleteTeam() {
        if (!selectedTeam) return;

        const confirmed = window.confirm(
            "Delete this team? This may be rejected if the team is registered."
        );

        if (!confirmed) return;

        setError("");
        setMessage("");
        setBusy(true);

        try {
            await api(`/api/teams/${teamIdOf(selectedTeam)}`, {
                method: "DELETE",
            });

            setSelectedTeamId(null);
            setMessage("Team deleted.");
            await loadData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Could not delete team."
            );
        } finally {
            setBusy(false);
        }
    }

    const members =
        selectedTeam?.members ?? selectedTeam?.Participants ?? [];

    return (
        <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
            <header className="space-y-2">
                <Link
                    href="/student"
                    className="text-sm text-blue-600 hover:underline"
                >
                    ← Back to dashboard
                </Link>

                <h1 className="text-3xl font-bold">Team Management</h1>

                <p className="text-gray-600">
                    Create teams for team events and manage their members.
                </p>
            </header>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700"
                >
                    {error}
                </div>
            )}

            {message && (
                <div
                    role="status"
                    className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700"
                >
                    {message}
                </div>
            )}

            <section className="rounded-xl border p-5">
                <h2 className="mb-4 text-xl font-semibold">Create a team</h2>

                {events.length === 0 ? (
                    <p className="text-sm text-gray-600">
                        No team events are currently available.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1">
                            <span className="block text-sm font-medium">
                                Team event
                            </span>

                            <select
                                value={eventId}
                                onChange={(event) =>
                                    setEventId(event.target.value)
                                }
                                className="w-full rounded-lg border px-3 py-2"
                            >
                                <option value="">Choose an event</option>

                                {events.map((item) => (
                                    <option
                                        key={eventIdOf(item)}
                                        value={eventIdOf(item)}
                                    >
                                        {eventNameOf(item)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="space-y-1">
                            <span className="block text-sm font-medium">
                                Team name
                            </span>

                            <input
                                value={teamName}
                                onChange={(event) =>
                                    setTeamName(event.target.value)
                                }
                                minLength={2}
                                maxLength={100}
                                placeholder="Enter team name"
                                className="w-full rounded-lg border px-3 py-2"
                            />
                        </label>
                    </div>
                )}

                <button
                    type="button"
                    disabled={busy || events.length === 0}
                    onClick={createTeam}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                    {busy ? "Please wait..." : "Create team"}
                </button>
            </section>

            <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="rounded-xl border p-5">
                    <h2 className="mb-4 text-xl font-semibold">Your teams</h2>

                    {loading ? (
                        <p className="text-gray-600">Loading teams...</p>
                    ) : teams.length === 0 ? (
                        <p className="text-gray-600">
                            You are not part of any teams yet.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {teams.map((team) => {
                                const id = teamIdOf(team);
                                const isSelected = id === selectedTeamId;

                                return (
                                    <button
                                        type="button"
                                        key={id}
                                        onClick={() => {
                                            setSelectedTeamId(id);
                                            setRenameValue(teamNameOf(team));
                                            setError("");
                                            setMessage("");
                                        }}
                                        className={`w-full rounded-lg border p-3 text-left ${
                                            isSelected
                                                ? "border-blue-500 bg-blue-50"
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        <span className="block font-medium">
                                            {teamNameOf(team)}
                                        </span>

                                        <span className="mt-1 block text-sm text-gray-600">
                                            {team.Event_Name ??
                                                team.eventName ??
                                                "Team event"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border p-5">
                    <h2 className="mb-4 text-xl font-semibold">
                        {selectedTeam
                            ? teamNameOf(selectedTeam)
                            : "Manage a team"}
                    </h2>

                    {!selectedTeam ? (
                        <p className="text-gray-600">
                            Select a team to manage its name and members.
                        </p>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Rename team
                                </label>

                                <div className="flex gap-2">
                                    <input
                                        value={renameValue}
                                        onChange={(event) =>
                                            setRenameValue(event.target.value)
                                        }
                                        minLength={2}
                                        maxLength={100}
                                        className="min-w-0 flex-1 rounded-lg border px-3 py-2"
                                    />

                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={renameTeam}
                                        className="rounded-lg border px-3 py-2 disabled:opacity-50"
                                    >
                                        Rename
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="mb-3 font-semibold">
                                    Team members
                                </h3>

                                {members.length === 0 ? (
                                    <p className="text-sm text-gray-600">
                                        Member details were not returned for this team.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {members.map((member) => {
                                            const id = memberIdOf(member);

                                            return (
                                                <li
                                                    key={id}
                                                    className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3"
                                                >
                                                    <div>
                                                        <p className="font-medium">
                                                            {memberNameOf(member)}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            Participant ID: {id}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            removeMember(id)
                                                        }
                                                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                                                    >
                                                        Remove
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Add participant by ID
                                </label>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        value={participantId}
                                        onChange={(event) =>
                                            setParticipantId(event.target.value)
                                        }
                                        placeholder="Participant ID"
                                        className="min-w-0 flex-1 rounded-lg border px-3 py-2"
                                    />

                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={addMember}
                                        className="rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={deleteTeam}
                                    className="rounded-lg border border-red-300 px-3 py-2 text-red-600 disabled:opacity-50"
                                >
                                    Delete team
                                </button>

                                <p className="mt-2 text-xs text-gray-500">
                                    The API may prevent deletion if the team is
                                    registered for an event.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}