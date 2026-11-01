
import { z } from "zod";

export class HttpError extends Error {
    status: number;
    details?: unknown;

    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

export function parseId(value: string, label = "id"): number {
    const id = Number(value);

    if (Number.isInteger(id) && id > 0) {
        return id;
    }

    throw new HttpError(400, `Invalid ${label}: ${value}`);
}

export async function parseBody<S extends z.ZodType>(
    req: Request,
    schema: S
): Promise<z.infer<S>> {
    let raw: unknown;

    try {
        raw = await req.json();
    } catch {
        throw new HttpError(400, "Request body must be valid JSON");
    }

    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
        throw new HttpError(
            400,
            parsed.error.issues[0]?.message ?? "Invalid input",
            parsed.error.issues
        );
    }

    return parsed.data;
}

export function parseQuery<S extends z.ZodType>(
    req: Request,
    schema: S
): z.infer<S> {
    const obj = Object.fromEntries(new URL(req.url).searchParams.entries());
    const parsed = schema.safeParse(obj);

    if (!parsed.success) {
        throw new HttpError(
            400,
            parsed.error.issues[0]?.message ?? "Invalid query"
        );
    }

    return parsed.data;
}

export function ok(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
    try {
        return await fn();
    } catch (error) {
        const dbError = fromDbError(error);
        return errorResponse(dbError ?? error);
    }
}

export function errorResponse(error: unknown): Response {
    if (error instanceof HttpError) {
        return new Response(
            JSON.stringify({
                error: error.message,
                ...(error.details !== undefined && { details: error.details })
            }),
            {
                status: error.status,
                headers: { "Content-Type": "application/json" }
            }
        );
    }

    return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        {
            status: 500,
            headers: { "Content-Type": "application/json" }
        }
    );
}

type MySqlError = {
    code?: string;
    errno?: number;
    sqlState?: string;
    sqlMessage?: string;
    message?: string;
};

export function fromDbError(error: unknown): HttpError | null {
    if (typeof error !== "object" || error === null) {
        return null;
    }

    const dbError = error as MySqlError;

    switch (dbError.code) {
        case "ER_DUP_ENTRY":
            return new HttpError(
                409,
                "A record with this value already exists"
            );

        case "ER_ROW_IS_REFERENCED_2":
            return new HttpError(
                409,
                "Cannot delete this record because it is being used"
            );

        case "ER_NO_REFERENCED_ROW_2":
            return new HttpError(
                400,
                "Referenced record does not exist"
            );

        case "ER_CHECK_CONSTRAINT_VIOLATED":
            return new HttpError(
                400,
                "Invalid value: database constraint violated"
            );
    }

    if (dbError.sqlState === "45000" || dbError.errno === 1644) {
        const message = dbError.sqlMessage ?? "";

        return new HttpError(
            400,
            message || "Database rule violation"
        );
    }

    return null;
}
