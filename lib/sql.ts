import type {Pool,PoolConnection,ResultSetHeader,RowDataPacket,} from "mysql2/promise";

export type Executor=Pool|PoolConnection;
export async function rows<T>(
    ex:Executor,
    sql:string,
    params:unknown[]=[]):Promise<T[]>
    {
        const [result] = await ex.query<RowDataPacket[]>(sql, params);
        return result as unknown as T[];
    }

export async function one<T>(
    ex: Executor,
    sql: string,
    params: unknown[] = []
): Promise<T | null> {
    const r= await rows<T>(ex,sql,params);
    return r[0] ?? null;
}

export async function exec(
    ex: Executor,
    sql: string,
    params: unknown[] = []
): Promise<ResultSetHeader> {
    const [result] = await ex.query<ResultSetHeader>(sql, params);
    return result;
}