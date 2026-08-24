import { ensureDatabase, isDateKey, isMonthKey, monthLabel } from "@/db/core";

export async function GET(request: Request) {
  try {
    const monthKey = new URL(request.url).searchParams.get("month") ?? "";
    if (!isMonthKey(monthKey)) return Response.json({ error: "صيغة الشهر غير صحيحة" }, { status: 400 });
    const db = await ensureDatabase();
    const result = await db
      .prepare(`SELECT id, month_key AS monthKey, title, details, task_date AS taskDate,
        status, created_at AS createdAt, reviewed_at AS reviewedAt, reviewer
        FROM tasks WHERE month_key = ? ORDER BY task_date DESC, id DESC`)
      .bind(monthKey)
      .all();
    return Response.json({ tasks: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر تحميل المهام" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { monthKey?: string; title?: string; details?: string; taskDate?: string };
    const monthKey = payload.monthKey?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const details = payload.details?.trim() ?? "";
    const taskDate = payload.taskDate?.trim() ?? "";
    if (!isMonthKey(monthKey)) return Response.json({ error: "صيغة الشهر غير صحيحة" }, { status: 400 });
    if (!title || title.length > 160) return Response.json({ error: "اكتب عنوانًا واضحًا للمهمة" }, { status: 400 });
    if (details.length > 2000) return Response.json({ error: "تفاصيل المهمة أطول من المسموح" }, { status: 400 });
    if (!isDateKey(taskDate)) return Response.json({ error: "تاريخ التنفيذ غير صحيح" }, { status: 400 });
    if (taskDate.slice(0, 7) !== monthKey) return Response.json({ error: "تاريخ المهمة يجب أن يكون داخل الشهر المعروض" }, { status: 400 });
    const db = await ensureDatabase();
    await db.prepare("INSERT OR IGNORE INTO months (month_key, label) VALUES (?, ?)").bind(monthKey, monthLabel(monthKey)).run();
    const inserted = await db
      .prepare("INSERT INTO tasks (month_key, title, details, task_date) VALUES (?, ?, ?, ?) RETURNING id")
      .bind(monthKey, title, details, taskDate)
      .first<{ id: number }>();
    if (!inserted) throw new Error("تعذر إنشاء المهمة");
    const task = await db
      .prepare(`SELECT id, month_key AS monthKey, title, details, task_date AS taskDate,
        status, created_at AS createdAt, reviewed_at AS reviewedAt, reviewer FROM tasks WHERE id = ?`)
      .bind(inserted.id)
      .first();
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر حفظ المهمة" }, { status: 500 });
  }
}
