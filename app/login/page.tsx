
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Role = "STUDENT" | "ORGANIZER" | "ADMIN";

const dashboardRoutes: Record<Role, string> = {
    STUDENT: "/student/dashboard",
    ORGANIZER: "/organizer/dashboard",
    ADMIN: "/admin/dashboard",
};

export default function LoginPage() {
    const router = useRouter();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Login failed. Please try again.");
                return;
            }

            const role = data.user.role as Role;
            router.push(dashboardRoutes[role]);
            router.refresh();
        } catch {
            setError("Unable to connect to the server. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-container">
            <h1>Welcome Back</h1>
            <p className="auth-subtitle">
                Log in to your FestHub account.
            </p>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="identifier">Email or Username</label>
                    <input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        placeholder="Enter email or username"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter password"
                        required
                    />
                </div>

                {error && <p className="form-error">{error}</p>}

                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>

            <p className="form-footer">
                Don&apos;t have an account?{" "}
                <Link href="/signup">Sign up</Link>
            </p>
        </main>
    );
}
