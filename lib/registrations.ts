import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { one } from "@/lib/sql";
import { HttpError } from "@/lib/http";
import type { Session } from "@/lib/auth";

export type RegistrationRow = {
    Registration_ID: number;
    Event_ID: number;
    Participant_ID: number | null;
    Team_ID: number | null;
    Status: "Pending" | "Confirmed" | "Cancelled";
};

// Runs a stored procedure that ends with  SELECT ... AS Registration_ID.
// mysql2 returns [ [result rows], ResultSetHeader ] for a CALL.
export async function callForId(sql: string, params: unknown[]): Promise<number> {
    const [result] = await db.query<RowDataPacket[][]>(sql, params);
    const id = result?.[0]?.[0]?.Registration_ID;
    if (typeof id !== "number") {
        throw new HttpError(500, "The procedure did not return a registration id");
    }
    return id;
}

export async function getRegistration(id: number): Promise<RegistrationRow> {
    const reg = await one<RegistrationRow>(
        db,
        `SELECT Registration_ID, Event_ID, Participant_ID, Team_ID, Status
         FROM REGISTRATION WHERE Registration_ID = ?`,
        [id]
    );
    if (!reg) {
        throw new HttpError(404, "Registration not found");
    }
    return reg;
}

// Is this student the registrant, or a member of the registered team?
export async function isOwnRegistration(session: Session, reg: RegistrationRow): Promise<boolean> {
    if (session.role !== "STUDENT" || session.participantId === null) {
        return false;
    }
    if (reg.Participant_ID !== null) {
        return reg.Participant_ID === session.participantId;
    }
    const member = await one(
        db,
        "SELECT 1 AS Yes FROM TEAM_MEMBER WHERE Team_ID = ? AND Participant_ID = ?",
        [reg.Team_ID, session.participantId]
    );
    return member !== null;
}
