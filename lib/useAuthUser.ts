"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type AuthUser = {
    userId: number;
    email: string;
    role: "STUDENT" | "ORGANIZER" | "ADMIN";
    participantId: number | null;
    organizerId: number | null;
};

// Loads the logged-in user from /api/auth/me.
// If `allowedRoles` is given and the user is not logged in or has another
// role, the page is sent to /login.
export function useAuthUser(allowedRoles?: AuthUser["role"][]) {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const rolesKey = allowedRoles ? allowedRoles.join(",") : "";

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const response = await fetch("/api/auth/me");
                if (!response.ok) {
                    if (rolesKey) router.replace("/login");
                    return;
                }
                const data = await response.json();
                const u = data.user as AuthUser;
                if (rolesKey && !rolesKey.split(",").includes(u.role)) {
                    router.replace("/login");
                    return;
                }
                if (!cancelled) setUser(u);
            } catch {
                if (rolesKey) router.replace("/login");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [router, rolesKey]);

    return { user, loading };
}
