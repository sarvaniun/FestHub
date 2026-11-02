
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    username,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Signup failed. Please try again.");
                return;
            }

            router.push("/student/dashboard");
            router.refresh();
        } catch {
            setError("Unable to connect to the server. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-container">
            <h1>Create Account</h1>
            <p className="auth-subtitle">
                Join FestHub and explore campus events.
            </p>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Enter your full name"
                        required
                        minLength={2}
                        maxLength={100}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your email"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="3–20 characters"
                        required
                        minLength={3}
                        maxLength={20}
                        pattern="[A-Za-z0-9_-]+"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        required
                        minLength={8}
                        maxLength={72}
                    />
                </div>

                {error && <p className="form-error">{error}</p>}

                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >
                    {loading ? "Creating account..." : "Sign Up"}
                </button>
            </form>

            <p className="form-footer">
                Already have an account?{" "}
                <Link href="/login">Login</Link>
            </p>
        </main>
    );
}
