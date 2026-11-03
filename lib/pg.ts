import { Pool } from "pg";

// Connection pool for the PostgreSQL + pgvector database (festhub_vectors).
// Settings come from .env.local: PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE.
export const pg = new Pool({
    host: process.env.PG_HOST ?? "localhost",
    port: Number(process.env.PG_PORT ?? 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE ?? "festhub_vectors",
    max: 5,
    connectionTimeoutMillis: 3000, // fail fast if Postgres is not running
});

// pgvector accepts a vector written as text: '[0.1,0.2,...]'.
export function toVectorLiteral(values: number[]): string {
    return `[${values.join(",")}]`;
}
