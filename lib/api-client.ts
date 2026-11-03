// Small helper used by pages to call our own API routes.
// It returns the JSON body on success, and throws an Error whose message is
// the API's { error } text on failure, so pages can show it directly.
export async function api<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown } = {}
): Promise<T> {
    const response = await fetch(path, {
        method: options.method ?? "GET",
        headers:
            options.body !== undefined
                ? { "Content-Type": "application/json" }
                : undefined,
        body:
            options.body !== undefined
                ? JSON.stringify(options.body)
                : undefined,
    });

    let data: unknown = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message =
            data && typeof data === "object" && "error" in data
                ? String((data as { error: unknown }).error)
                : `Request failed (${response.status})`;
        throw new Error(message);
    }

    return data as T;
}

// "2026-10-11T03:30:00.000Z" -> "11 Oct 2026, 9:00 am" in the viewer's time zone
export function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) {
        return "—";
    }
    return new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

// 60000 -> "₹60,000"
export function formatRupees(value: string | number | null | undefined): string {
    const amount = Number(value ?? 0);
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// For <input type="datetime-local">: Date -> "2026-10-11T09:00"
export function toDateTimeInput(value: string | Date): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`;
}
