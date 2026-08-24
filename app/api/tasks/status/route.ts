import { ensureDatabase } from "@/db/core";

const statuses = new Set(["pending", "approved", "rejected"]);

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number; status?: string };
    const id = Number(payload.id);
    const status = payload.status ?? "";
    if (!Number.isSafeInteger(id) || id < 1 || !statuses.has(status)) return Response.json({ error: "بيانات الاعتماد غير صحيحة" }, { status: 400 });
    const db = await ensureDatabase();
    await db.prepare("UPDATE tasks SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewer = ? WHERE id = ?").bind(status, "Mizo", id).run();
    const task = await db
      .prepare(`SELECT id, month_key AS monthKey, title, details, task_date AS taskDate,
        status, created_at AS createdAt, reviewed_at AS reviewedAt, reviewer FROM tasks WHERE id = ?`)
      .bind(id)
      .first();
    if (!task) return Response.json({ error: "المهمة غير موجودة" }, { status: 404 });
    return Response.json({ task });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر تحديث الاعتماد" }, { status: 500 });
  }
}
