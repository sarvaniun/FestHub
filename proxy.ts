import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/config";

// Next.js 16 "proxy" (it was called middleware before v16). It runs
// before a PAGE is served and sends people away from pages their role
// may not open. The API routes check roles themselves (requireRole), so
// this is a second line of defence for the UI, not the only one.
//
//   /admin/*      → ADMIN only
//   /organizer/*  → ORGANIZER or ADMIN (admins can also enter scores etc.)
//   /student/*    → STUDENT only
const RULES: { prefix: string; roles: string[] }[] = [
    { prefix: "/admin", roles: ["ADMIN"] },
    { prefix: "/organizer", roles: ["ORGANIZER", "ADMIN"] },
    { prefix: "/student", roles: ["STUDENT"] },
];

async function roleFromCookie(request: NextRequest): Promise<string | null> {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const secret = process.env.AUTH_SECRET;
    if (!token || !secret) {
        return null;
    }
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
        return typeof payload.role === "string" ? payload.role : null;
    } catch {
        return null; // expired or tampered token
    }
}

export async function proxy(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const rule = RULES.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));
    if (!rule) {
        return NextResponse.next();
    }

    const role = await roleFromCookie(request);
    if (!role) {
        const login = new URL("/login", request.url);
        return NextResponse.redirect(login);
    }
    if (!rule.roles.includes(role)) {
        // logged in, but wrong role → their own dashboard
        const home = role === "ADMIN" ? "/admin/dashboard" : role === "ORGANIZER" ? "/organizer/dashboard" : "/student/dashboard";
        return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/organizer/:path*", "/student/:path*"],
};
