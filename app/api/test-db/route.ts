import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT VERSION() AS version");

    return Response.json({
      success: true,
      message: "MySQL connected successfully",
      database: rows,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    return Response.json(
      {
        success: false,
        message: "MySQL connection failed",
      },
      { status: 500 }
    );
  }
}