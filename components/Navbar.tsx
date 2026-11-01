
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type User = {
    userId: number;
    email: string;
    username?: string;
    role: "STUDENT" | "ORGANIZER" | "ADMIN";
};

const dashboardRoutes = {
    STUDENT: "/student/dashboard",
    ORGANIZER: "/organizer/dashboard",
    ADMIN: "/admin/dashboard",
};

export default function Navbar() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        async function loadUser() {
            setLoading(true);

            try {
                const response = await fetch("/api/auth/me");

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            } catch {
                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        loadUser();
    }, [pathname]);

    async function handleLogout() {
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Logout failed");
            }

            setUser(null);
            router.push("/login");
            router.refresh();
        } catch {
            alert("Unable to log out. Please try again.");
        }
    }

    return (
        <header className="navbar">
            <Link href="/" className="navbar-brand">
                FestHub
            </Link>

            <nav className="navbar-links">
                <Link href="/">Home</Link>

                {!loading && !user && (
                    <>
                        <Link href="/login">Login</Link>
                        <Link href="/signup" className="nav-signup">
                            Sign up
                        </Link>
                    </>
                )}

                {!loading && user && (
                    <>
                        <Link href={dashboardRoutes[user.role]}>
                            Dashboard
                        </Link>

                        <span className="navbar-user">
                            {user.username || user.email} ({user.role})
                        </span>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="nav-logout"
                        >
                            Logout
                        </button>
                    </>
                )}
            </nav>
        </header>
    );
}
