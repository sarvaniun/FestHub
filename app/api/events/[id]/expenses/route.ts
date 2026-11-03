import { z } from "zod";
import { db } from "@/lib/db";
import { rows, one, exec } from "@/lib/sql";
import { handle, ok, parseBody, parseId } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { assertCanManageEvent, assertEventExists } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

const CATEGORIES = ["Venue", "Equipment", "Prizes", "Food", "Marketing", "Logistics", "Other"] as const;

const expenseSchema = z.object({
    description: z.string().trim().min(2, { message: "Describe the expense" }).max(200),
    category: z.enum(CATEGORIES).default("Other"),
    amount: z.coerce.number().positive({ message: "Amount must be more than 0" }),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
});

// GET /api/events/[id]/expenses  (Admin, or an Organizer of this event)
// The expense list plus this event's row from the V_BUDGET_STATUS view.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);
        await assertCanManageEvent(session, eventId);

        const expenses = await rows(
            db,
            `SELECT Expense_ID, Description, Category, Amount,
                    DATE_FORMAT(Expense_Date, '%Y-%m-%d') AS Expense_Date
             FROM EXPENSE
             WHERE Event_ID = ?
             ORDER BY Expense_Date, Expense_ID`,
            [eventId]
        );

        const budget = await one(
            db,
            "SELECT * FROM V_BUDGET_STATUS WHERE Event_ID = ?",
            [eventId]
        );

        return ok({ expenses, budget, categories: CATEGORIES });
    });
}

// POST /api/events/[id]/expenses  (Admin, or an Organizer of this event)
// Body: { description, category?, amount, expenseDate }
// CHECK (Amount > 0) and the Category ENUM are enforced by MySQL too.
export async function POST(req: Request, { params }: Params): Promise<Response> {
    return handle(async () => {
        const session = await requireRole("ADMIN", "ORGANIZER");
        const eventId = parseId((await params).id, "event id");
        await assertEventExists(eventId);
        await assertCanManageEvent(session, eventId);
        const input = await parseBody(req, expenseSchema);

        const result = await exec(
            db,
            `INSERT INTO EXPENSE (Event_ID, Description, Category, Amount, Expense_Date)
             VALUES (?, ?, ?, ?, ?)`,
            [eventId, input.description, input.category, input.amount, input.expenseDate]
        );

        return ok({ expense: { Expense_ID: result.insertId } }, 201);
    });
}
