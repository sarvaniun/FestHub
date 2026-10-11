import type {PoolConnection} from "mysql2/promise";
import {db} from "@/lib/db";

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await db.getConnection();
    try {
        await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    }
    catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    }
    finally {
        conn.release();
    }
}
