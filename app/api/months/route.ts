import { ensureDatabase, isMonthKey, monthKeyForRiyadh, monthLabel } from "@/db/core";
import { apiJson, apiOptions } from "@/lib/api-response";

export function OPTIONS(request: Request) {
  return apiOptions(request, "GET, POST, OPTIONS");
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const currentMonth = monthKeyForRiyadh();
    await db.prepare("INSERT OR IGNORE INTO months (month_key, label) VALUES (?, ?)").bind(currentMonth, monthLabel(currentMonth)).run();
    const result = await db.prepare("SELECT month_key AS monthKey, label, created_at AS createdAt FROM months ORDER BY month_key DESC").all();
    const months = result.results;
    return apiJson(request, { months, activeMonth: String(months[0]?.monthKey ?? currentMonth) });
  } catch (error) {
    return apiJson(request, { error: error instanceof Error ? error.message : "تعذر تحميل الشهور" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { monthKey?: string };
    const monthKey = payload.monthKey?.trim() ?? "";
    if (!isMonthKey(monthKey)) return apiJson(request, { error: "صيغة الشهر غير صحيحة" }, { status: 400 });
    const db = await ensureDatabase();
    const label = monthLabel(monthKey);
    await db.prepare("INSERT OR IGNORE INTO months (month_key, label) VALUES (?, ?)").bind(monthKey, label).run();
    const month = await db.prepare("SELECT month_key AS monthKey, label, created_at AS createdAt FROM months WHERE month_key = ?").bind(monthKey).first();
    return apiJson(request, { month }, { status: 201 });
  } catch (error) {
    return apiJson(request, { error: error instanceof Error ? error.message : "تعذر إضافة الشهر" }, { status: 500 });
  }
}
