import { db } from "@/lib/db";
import { one, exec } from "@/lib/sql";
import { handle, ok, parseId, HttpError } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/expenses/[id]  (Admin, or an Organizer of the expense's event)
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const expenseId = parseId((await params).id, "expense id");

        const expense = await one<{ Event_ID: number }>(
            db,
            "SELECT Event_ID FROM EXPENSE WHERE Expense_ID = ?",
            [expenseId]
        );
        if (!expense) {
            throw new HttpError(404, "Expense not found");
        }
        await assertCanManageEvent(session, expense.Event_ID);

        await exec(db, "DELETE FROM EXPENSE WHERE Expense_ID = ?", [expenseId]);
        return ok({ deleted: true });
    });
}
