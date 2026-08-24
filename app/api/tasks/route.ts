import { ensureDatabase, isDateKey, isMonthKey, monthLabel } from "@/db/core";
import { apiJson, apiOptions } from "@/lib/api-response";
import { isSupervisor } from "@/lib/supervisor-auth";

export function OPTIONS(request: Request) {
  return apiOptions(request, "GET, POST, DELETE, OPTIONS");
}

export async function GET(request: Request) {
  try {
    const monthKey = new URL(request.url).searchParams.get("month") ?? "";
    if (!isMonthKey(monthKey)) return apiJson(request, { error: "صيغة الشهر غير صحيحة" }, { status: 400 });
    const db = await ensureDatabase();
    const result = await db
      .prepare(`SELECT id, month_key AS monthKey, title, details, task_date AS taskDate,
        status, created_at AS createdAt, reviewed_at AS reviewedAt, reviewer
        FROM tasks WHERE month_key = ? ORDER BY task_date DESC, id DESC`)
      .bind(monthKey)
      .all();
    return apiJson(request, { tasks: result.results });
  } catch (error) {
    return apiJson(request, { error: error instanceof Error ? error.message : "تعذر تحميل المهام" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isSupervisor(request))) return apiJson(request, { error: "يلزم تسجيل الدخول لإضافة المهام" }, { status: 401 });
    const payload = (await request.json()) as { monthKey?: string; title?: string; details?: string; taskDate?: string };
    const monthKey = payload.monthKey?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const details = payload.details?.trim() ?? "";
    const taskDate = payload.taskDate?.trim() ?? "";
    if (!isMonthKey(monthKey)) return apiJson(request, { error: "صيغة الشهر غير صحيحة" }, { status: 400 });
    if (!title || title.length > 160) return apiJson(request, { error: "اكتب عنوانًا واضحًا للمهمة" }, { status: 400 });
    if (details.length > 2000) return apiJson(request, { error: "تفاصيل المهمة أطول من المسموح" }, { status: 400 });
    if (!isDateKey(taskDate)) return apiJson(request, { error: "تاريخ التنفيذ غير صحيح" }, { status: 400 });
    if (taskDate.slice(0, 7) !== monthKey) return apiJson(request, { error: "تاريخ المهمة يجب أن يكون داخل الشهر المعروض" }, { status: 400 });
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
    return apiJson(request, { task }, { status: 201 });
  } catch (error) {
    return apiJson(request, { error: error instanceof Error ? error.message : "تعذر حفظ المهمة" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isSupervisor(request))) {
      return apiJson(request, { error: "سجّل دخول الأول عشان تحذف المهمة." }, { status: 401 });
    }
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id < 1) {
      return apiJson(request, { error: "رقم المهمة مش صحيح." }, { status: 400 });
    }
    const db = await ensureDatabase();
    const deleted = await db
      .prepare("DELETE FROM tasks WHERE id = ? RETURNING id")
      .bind(id)
      .first<{ id: number }>();
    if (!deleted) return apiJson(request, { error: "المهمة دي مش موجودة." }, { status: 404 });
    return apiJson(request, { deleted: true, id: deleted.id });
  } catch (error) {
    return apiJson(request, { error: error instanceof Error ? error.message : "المهمة متحذفتش، جرّب تاني." }, { status: 500 });
  }
}
