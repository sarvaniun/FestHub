import type { Role } from "@/lib/config";
import bcryptjs from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { ROLES, SESSION_COOKIE, SESSION_HOURS } from "@/lib/config";
import { cookies } from "next/headers";
import { HttpError } from "@/lib/http";

export type Session = {
    userId: number;
    email: string;
    role: Role;
    participantId: number | null;
    organizerId: number | null;
};

const BCRYPT_COST = 12;

// Hash a password
export function hashPassword(plain: string): Promise<string> {
    return bcryptjs.hash(plain, BCRYPT_COST);
}

// Verify a password against its stored hash
export function verifyPassword(
    plain: string,
    hash: string
): Promise<boolean> {
    return bcryptjs.compare(plain, hash);
}

// Retrieve and validate the authentication secret
function getAuthSecret(): Uint8Array {
    const secret = process.env.AUTH_SECRET;

    if (!secret) {
        throw new Error("AUTH_SECRET environment variable is not set");
    }

    if (secret.length < 32) {
        throw new Error("AUTH_SECRET must be at least 32 characters long");
    }

    return new TextEncoder().encode(secret);
}

// Create a signed JWT session token
export async function createSessionToken(
    session: Session
): Promise<string> {
    const token = new SignJWT(session)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_HOURS}h`);

    return token.sign(getAuthSecret());
}

// Verify a JWT and validate its session payload
export async function verifySessionToken(
    token: string
): Promise<Session | null> {
    try {
        const { payload } = await jwtVerify(token, getAuthSecret());

        const {
            userId,
            email,
            role,
            participantId,
            organizerId,
        } = payload;

        if (
            typeof userId !== "number" ||
            !Number.isInteger(userId) ||
            userId <= 0 ||
            typeof email !== "string" ||
            typeof role !== "string" ||
            !ROLES.includes(role as Role) ||
            !(
                participantId === null ||
                (typeof participantId === "number" &&
                    Number.isInteger(participantId) &&
                    participantId > 0)
            ) ||
            !(
                organizerId === null ||
                (typeof organizerId === "number" &&
                    Number.isInteger(organizerId) &&
                    organizerId > 0)
            )
        ) {
            return null;
        }

        return {
            userId,
            email,
            role: role as Role,
            participantId,
            organizerId,
        };
    } catch {
        return null;
    }
}

// Store the JWT in an HTTP-only session cookie
export async function setSessionCookie(
    session: Session
): Promise<void> {
    const token = await createSessionToken(session);
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_HOURS * 3600,
    });
}

// Delete the session cookie during logout
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

// Retrieve the current session from the cookie
export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (!token) {
        return null;
    }

    return verifySessionToken(token);
}

// Require an authenticated session
export async function requireSession(): Promise<Session> {
    const session = await getSession();

    if (!session) {
        throw new HttpError(401, "Not authenticated");
    }

    return session;
}

// Require a session with one of the specified roles
export async function requireRole(
    ...allowedRoles: Role[]
): Promise<Session> {
    const session = await requireSession();

    if (!allowedRoles.includes(session.role)) {
        throw new HttpError(403, "Forbidden");
    }

    return session;
}
