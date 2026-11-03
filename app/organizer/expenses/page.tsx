"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, formatRupees } from "@/lib/api-client";
import { useAuthUser } from "@/lib/useAuthUser";
import EventPicker from "@/components/EventPicker";
import BudgetBadge from "@/components/BudgetBadge";
import "@/components/fh.css";

type Expense = { Expense_ID: number; Description: string; Category: string; Amount: string; Expense_Date: string };
type Budget = {
    Event_ID: number;
    Event_Name: string;
    Budget: string;
    Spent: string;
    Remaining: string;
    Utilisation_Percent: string | null;
    Budget_Status: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
    const { user, loading } = useAuthUser(["ADMIN", "ORGANIZER"]);
    const [eventId, setEventId] = useState("");
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [budget, setBudget] = useState<Budget | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
    const [form, setForm] = useState({ description: "", category: "Other", amount: "", expenseDate: today() });
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadAll = useCallback(async () => {
        const d = await api<{ budget: Budget[] }>("/api/budget");
        setAllBudgets(d.budget);
    }, []);

    const loadEvent = useCallback(async (id: string) => {
        if (!id) return;
        const d = await api<{ expenses: Expense[]; budget: Budget; categories: string[] }>(`/api/events/${id}/expenses`);
        setExpenses(d.expenses);
        setBudget(d.budget);
        setCategories(d.categories);
    }, []);

    useEffect(() => {
        if (user) loadAll().catch((e: Error) => setError(e.message));
    }, [user, loadAll]);

    useEffect(() => {
        loadEvent(eventId).catch((e: Error) => setError(e.message));
    }, [eventId, loadEvent]);

    async function add(event: FormEvent) {
        event.preventDefault();
        setError("");
        setMessage("");
        try {
            await api(`/api/events/${eventId}/expenses`, {
                method: "POST",
                body: { ...form, amount: Number(form.amount) },
            });
            setMessage("Expense added.");
            setForm({ description: "", category: "Other", amount: "", expenseDate: today() });
            await Promise.all([loadEvent(eventId), loadAll()]);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    async function remove(x: Expense) {
        if (!confirm(`Delete "${x.Description}"?`)) return;
        setError("");
        setMessage("");
        try {
            await api(`/api/expenses/${x.Expense_ID}`, { method: "DELETE" });
            setMessage("Expense deleted.");
            await Promise.all([loadEvent(eventId), loadAll()]);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    if (loading || !user) {
        return <main className="page-container">Loading...</main>;
    }

    const backHref = user.role === "ADMIN" ? "/admin/dashboard" : "/organizer/dashboard";

    return (
        <main className="page-container">
            <div className="fh-header">
                <div>
                    <h1>Expenses and budget</h1>
                    <p className="fh-muted">Log what each event spends and compare it with its budget.</p>
                </div>
                <Link href={backHref} className="fh-muted">← Back to dashboard</Link>
            </div>

            {error && <div className="fh-error">{error}</div>}
            {message && <div className="fh-success">{message}</div>}

            <section className="fh-card">
                <h2>Budget status (V_BUDGET_STATUS)</h2>
                <div className="fh-table-wrap">
                    <table className="fh-table">
                        <thead><tr><th>Event</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Used</th><th>Status</th></tr></thead>
                        <tbody>
                            {allBudgets.map((b) => (
                                <tr key={b.Event_ID}>
                                    <td>{b.Event_Name}</td>
                                    <td>{formatRupees(b.Budget)}</td>
                                    <td>{formatRupees(b.Spent)}</td>
                                    <td>{formatRupees(b.Remaining)}</td>
                                    <td>{b.Utilisation_Percent ?? "—"}%</td>
                                    <td><BudgetBadge status={b.Budget_Status} /></td>
                                </tr>
                            ))}
                            {allBudgets.length === 0 && <tr><td colSpan={6} className="fh-muted">No events.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="fh-card">
                <h2>Event</h2>
                <EventPicker role={user.role === "ADMIN" ? "ADMIN" : "ORGANIZER"} value={eventId} onChange={setEventId} />
                {budget && (
                    <p style={{ marginTop: 14 }}>
                        Budget {formatRupees(budget.Budget)} · Spent {formatRupees(budget.Spent)} · Remaining{" "}
                        {formatRupees(budget.Remaining)} <BudgetBadge status={budget.Budget_Status} />
                    </p>
                )}
            </section>

            {eventId && (
                <section className="fh-card">
                    <h2>Add an expense</h2>
                    <form className="fh-form" onSubmit={add}>
                        <label>
                            Description
                            <input className="fh-input" required value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </label>
                        <label>
                            Category
                            <select className="fh-select" value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label>
                            Amount (₹)
                            <input className="fh-input" type="number" min={0.01} step="0.01" required value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                        </label>
                        <label>
                            Date
                            <input className="fh-input" type="date" required value={form.expenseDate}
                                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
                        </label>
                        <button className="fh-btn" type="submit">Add expense</button>
                    </form>

                    <table className="fh-table" style={{ marginTop: 20 }}>
                        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th></th></tr></thead>
                        <tbody>
                            {expenses.map((x) => (
                                <tr key={x.Expense_ID}>
                                    <td>{x.Expense_Date}</td>
                                    <td>{x.Description}</td>
                                    <td>{x.Category}</td>
                                    <td>{formatRupees(x.Amount)}</td>
                                    <td><button className="fh-btn fh-btn-danger fh-btn-small" onClick={() => remove(x)}>Delete</button></td>
                                </tr>
                            ))}
                            {expenses.length === 0 && <tr><td colSpan={5} className="fh-muted">No expenses yet.</td></tr>}
                        </tbody>
                    </table>
                </section>
            )}
        </main>
    );
}
