import type { Session } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/sql";
import { HttpError } from "@/lib/http";

// Admins can manage every event. Organizers can manage only the events
// they are assigned to in EVENT_ORGANIZER.
export async function assertCanManageEvent(
    session: Session,
    eventId: number
): Promise<void> {
    if (session.role === "ADMIN") {
        return;
    }

    if (session.role !== "ORGANIZER" || session.organizerId === null) {
        throw new HttpError(403, "Only admins and organizers can do this");
    }

    const link = await one<{ Event_ID: number }>(
        db,
        `SELECT Event_ID
         FROM EVENT_ORGANIZER
         WHERE Event_ID = ? AND Organizer_ID = ?`,
        [eventId, session.organizerId]
    );

    if (!link) {
        throw new HttpError(403, "You are not an organizer of this event");
    }
}

// Throws 404 when the event does not exist.
export async function assertEventExists(eventId: number): Promise<void> {
    const event = await one<{ Event_ID: number }>(
        db,
        "SELECT Event_ID FROM EVENT WHERE Event_ID = ?",
        [eventId]
    );

    if (!event) {
        throw new HttpError(404, "Event not found");
    }
}
