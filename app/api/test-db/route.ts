import { db } from "@/lib/db";
import { handle, ok, HttpError } from "@/lib/http";

export async function GET(): Promise<Response> {
    return handle(async () => {
        if (process.env.NODE_ENV !== "development") {
            throw new HttpError(404, "Not found");
        }

        const [rows] = await db.query(
            "SELECT VERSION() AS version"
        );

        return ok({
            success: true,
            message: "MySQL connected successfully",
            database: rows,
        });
    });
}
