import { db } from "@/lib/db";
import { one, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { venueUpdateSchema, buildSet } from "@/lib/people-validators";

type Params = { params: Promise<{ id: string }> };

// GET /api/venues/[id]  (public)
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const venueId = parseId((await params).id, "venue id");
        const venue = await one(
            db,
            "SELECT Venue_ID, Venue_Name, Capacity, Location FROM VENUE WHERE Venue_ID = ?",
            [venueId]
        );
        if (!venue) {
            throw new HttpError(404, "Venue not found");
        }
        return ok({ venue });
    });
}

// PUT /api/venues/[id]  (Admin)
export async function PUT(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const venueId = parseId((await params).id, "venue id");
        const input = await parseBody(req, venueUpdateSchema);

        const set = buildSet(input, {
            name: "Venue_Name",
            capacity: "Capacity",
            location: "Location",
        });

        const result = await exec(
            db,
            `UPDATE VENUE SET ${set.sql} WHERE Venue_ID = ?`,
            [...set.values, venueId]
        );
        if (result.affectedRows === 0) {
            throw new HttpError(404, "Venue not found");
        }
        return ok({ venue: { Venue_ID: venueId } });
    });
}

// DELETE /api/venues/[id]  (Admin)
// EVENT.Venue_ID has no ON DELETE action (RESTRICT), so a venue that still
// hosts events cannot be deleted. We say so clearly instead of the generic
// 409 message.
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        await requireRole("ADMIN");
        const venueId = parseId((await params).id, "venue id");

        try {
            const result = await exec(db, "DELETE FROM VENUE WHERE Venue_ID = ?", [venueId]);
            if (result.affectedRows === 0) {
                throw new HttpError(404, "Venue not found");
            }
        } catch (error) {
            if ((error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
                throw new HttpError(
                    409,
                    "This venue still hosts events. Move or delete those events first (foreign key RESTRICT)."
                );
            }
            throw error;
        }

        return ok({ deleted: true });
    });
}
