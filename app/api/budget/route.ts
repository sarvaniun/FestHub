import { db } from "@/lib/db";
import { rows } from "@/lib/sql";
import { handle, ok } from "@/lib/http";
import { requireRole } from "@/lib/auth";

// GET /api/budget  (Admin: every event; Organizer: only their events)
// Reads the V_BUDGET_STATUS view (sql/11_v_budget_status.sql), plus the
// spending-by-category breakdown (Stage 2 Q12c).
export async function GET(): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const onlyMine = session.role === "ORGANIZER";

        const budget = await rows(
            db,
            `SELECT b.*
             FROM V_BUDGET_STATUS b
             ${onlyMine ? "JOIN EVENT_ORGANIZER eo ON eo.Event_ID = b.Event_ID AND eo.Organizer_ID = ?" : ""}
             ORDER BY b.Utilisation_Percent DESC`,
            onlyMine ? [session.organizerId] : []
        );

        const byCategory = await rows(
            db,
            `SELECT x.Category, COUNT(*) AS Expense_Entries, SUM(x.Amount) AS Total_Spent
             FROM EXPENSE x
             ${onlyMine ? "JOIN EVENT_ORGANIZER eo ON eo.Event_ID = x.Event_ID AND eo.Organizer_ID = ?" : ""}
             GROUP BY x.Category
             ORDER BY Total_Spent DESC`,
            onlyMine ? [session.organizerId] : []
        );

        return ok({ budget, byCategory });
    });
}
