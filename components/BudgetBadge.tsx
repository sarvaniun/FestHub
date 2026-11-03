import "@/components/fh.css";

// Coloured badge for V_BUDGET_STATUS.Budget_Status
export default function BudgetBadge({ status }: { status: string }) {
    const cls =
        status === "Over budget" ? "fh-badge fh-badge-red"
        : status === "Nearly used up" ? "fh-badge fh-badge-amber"
        : "fh-badge fh-badge-green";
    return <span className={cls}>{status}</span>;
}
