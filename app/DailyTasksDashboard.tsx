"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type TaskStatus = "pending" | "approved" | "rejected";

type Task = {
  id: number;
  monthKey: string;
  title: string;
  details: string;
  taskDate: string;
  status: TaskStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
};

type Month = {
  monthKey: string;
  label: string;
  createdAt: string;
};

const statusCopy: Record<TaskStatus, string> = {
  pending: "في انتظار الاعتماد",
  approved: "معتمدة",
  rejected: "غير معتمدة",
};

const nextStatus: Record<TaskStatus, TaskStatus> = {
  pending: "approved",
  approved: "rejected",
  rejected: "pending",
};

function riyadhDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dateParts(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat("ar-SA", { day: "2-digit" }).format(value),
    month: new Intl.DateTimeFormat("ar-SA", { month: "short" }).format(value),
  };
}

function createdTime(date: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function DailyTasksDashboard() {
  const [months, setMonths] = useState<Month[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [taskDate, setTaskDate] = useState(riyadhDate);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [supervisor, setSupervisor] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [newMonth, setNewMonth] = useState("");

  const loadMonths = useCallback(async () => {
    const response = await fetch("/api/months", { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تحميل الشهور");
    const data = (await response.json()) as { months: Month[]; activeMonth: string };
    setMonths(data.months);
    setSelectedMonth((current) => current || data.activeMonth);
  }, []);

  const loadTasks = useCallback(async (monthKey: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks?month=${encodeURIComponent(monthKey)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("تعذر تحميل المهام");
      const data = (await response.json()) as { tasks: Task[] };
      setTasks(data.tasks);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      loadMonths(),
      fetch("/api/auth", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { authenticated?: boolean }) => setSupervisor(Boolean(data.authenticated)))
        .catch(() => setSupervisor(false)),
    ]).catch(() => setMessage("تعذر الاتصال بقاعدة البيانات. حاول تحديث الصفحة."));
  }, [loadMonths]);

  useEffect(() => {
    if (selectedMonth) void loadTasks(selectedMonth);
  }, [selectedMonth, loadTasks]);

  const selectedMonthLabel =
    months.find((month) => month.monthKey === selectedMonth)?.label ?? "جارٍ التحميل";

  const counts = useMemo(
    () => ({
      total: tasks.length,
      approved: tasks.filter((task) => task.status === "approved").length,
      rejected: tasks.filter((task) => task.status === "rejected").length,
      pending: tasks.filter((task) => task.status === "pending").length,
    }),
    [tasks],
  );

  const visibleTasks = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((task) => task.status === filter)),
    [filter, tasks],
  );

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !selectedMonth) return;
    if (!supervisor) {
      setLoginOpen(true);
      setMessage("سجّل الدخول أولًا لإضافة المهمة. سيظل ما كتبته موجودًا في النموذج.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          monthKey: selectedMonth,
          title: title.trim(),
          details: details.trim(),
          taskDate,
        }),
      });
      const data = (await response.json()) as { task?: Task; error?: string };
      if (!response.ok || !data.task) throw new Error(data.error ?? "تعذر حفظ المهمة");
      setTasks((current) => [data.task as Task, ...current]);
      setTitle("");
      setDetails("");
      setMessage("تم تسجيل المهمة وحفظها في سجل الشهر.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ المهمة");
    } finally {
      setSaving(false);
    }
  }

  async function setTaskStatus(taskId: number) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const response = await fetch("/api/tasks/status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: taskId, status: nextStatus[task.status] }),
    });
    const data = (await response.json()) as { task?: Task; error?: string };
    if (!response.ok || !data.task) {
      setMessage(data.error ?? "تعذر تحديث الاعتماد");
      return;
    }
    setTasks((current) => current.map((item) => (item.id === taskId ? (data.task as Task) : item)));
  }

  function approvalClick(taskId: number) {
    void setTaskStatus(taskId);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const data = (await response.json()) as { authenticated?: boolean; error?: string };
    const errorElement = event.currentTarget.querySelector<HTMLElement>("[data-login-error]");
    if (!response.ok || !data.authenticated) {
      if (errorElement) errorElement.textContent = data.error ?? "بيانات الدخول غير صحيحة";
      return;
    }
    setSupervisor(true);
    setLoginOpen(false);
    setMessage("تم تسجيل الدخول. يمكنك الآن إضافة المهمة المكتوبة في النموذج.");
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    setSupervisor(false);
    setMessage("تم إنهاء جلسة المشرف.");
  }

  async function addMonth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMonth) return;
    const response = await fetch("/api/months", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ monthKey: newMonth }),
    });
    const data = (await response.json()) as { month?: Month; error?: string };
    if (!response.ok || !data.month) {
      setMessage(data.error ?? "تعذر إضافة الشهر");
      return;
    }
    await loadMonths();
    setSelectedMonth(data.month.monthKey);
    setNewMonth("");
    setMonthOpen(false);
    setMessage("تم فتح شهر جديد، والشهور السابقة محفوظة في الأرشيف.");
  }

  return (
    <main className="app-shell">
      <section className="top-area">
        <div className="container">
          <header className="topbar">
            <div className="brand">
              <img src="https://tamheed.sa/wp-content/uploads/2025/12/logo.svg" alt="تمهيد" />
              <span className="brand-divider" aria-hidden="true" />
              <span className="brand-label">سجل المهام الداخلية</span>
            </div>
            <button
              className={`supervisor-button${supervisor ? " is-active" : ""}`}
              type="button"
              onClick={() => (supervisor ? void logout() : setLoginOpen(true))}
            >
              <span className="supervisor-dot" aria-hidden="true" />
              {supervisor ? "مسجّل الدخول · خروج" : "دخول لإضافة المهام"}
            </button>
          </header>

          <div className="hero">
            <div>
              <span className="eyebrow">نظام متابعة الإنجاز اليومي</span>
              <h1>كل يوم موثّق.<br />كل <span>إنجاز محسوب.</span></h1>
              <p className="hero-copy">
                سجّل ما أنجزته أولًا بأول، واترك للمشرف مساحة واضحة للمراجعة والاعتماد.
                سجل الشهر يظل محفوظًا مهما بدأ شهر جديد.
              </p>
            </div>
            <aside className="hero-note">
              <span className="hero-note-label">قاعدة بسيطة</span>
              <strong>المهمة الواضحة أسهل في الاعتماد.</strong>
              <p>اكتب عنوانًا محددًا، وأضف في الوصف النتيجة التي خرجت بها أو رابط التسليم إن وجد.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="workspace container" aria-label="مساحة المهام">
        <div className="control-card">
          <div className="month-row">
            <div className="month-copy"><small>شهر العمل المعروض</small><h2>{selectedMonthLabel}</h2></div>
            <div className="month-actions">
              <select
                className="archive-select"
                aria-label="أرشيف الشهور"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              >
                {months.map((month, index) => (
                  <option key={month.monthKey} value={month.monthKey}>
                    {index === 0 ? `الشهر الأحدث — ${month.label}` : `الأرشيف — ${month.label}`}
                  </option>
                ))}
              </select>
              <button className="ghost-button" type="button" onClick={() => setMonthOpen(true)}>+ شهر جديد</button>
            </div>
          </div>

          <form className="composer" onSubmit={addTask}>
            <div className="field">
              <label htmlFor="task-title">عنوان المهمة</label>
              <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: تجهيز تقرير الحملة" maxLength={160} required />
            </div>
            <div className="field field-details">
              <label htmlFor="task-details">تفاصيل الإنجاز</label>
              <textarea id="task-details" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="ما الذي تم تنفيذه؟ وما النتيجة؟" maxLength={2000} />
            </div>
            <div className="field">
              <label htmlFor="task-date">تاريخ التنفيذ</label>
              <input id="task-date" type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} required />
            </div>
            <button className="gold-button" type="submit" disabled={saving || !selectedMonth}>{saving ? "جارٍ الحفظ…" : "إضافة المهمة"}</button>
          </form>
          {message && <div className="message" role="status">{message}</div>}
        </div>

        <div className="overview" aria-label="ملخص الشهر">
          <div className="metric"><span className="metric-mark total">≡</span><div><strong>{counts.total}</strong><span>كل المهام</span></div></div>
          <div className="metric"><span className="metric-mark approved">✓</span><div><strong>{counts.approved}</strong><span>معتمدة</span></div></div>
          <div className="metric"><span className="metric-mark rejected">×</span><div><strong>{counts.rejected}</strong><span>غير معتمدة</span></div></div>
          <div className="metric"><span className="metric-mark pending">…</span><div><strong>{counts.pending}</strong><span>بانتظار الاعتماد</span></div></div>
        </div>

        <div className="list-heading">
          <div><h2>سجل المهام</h2><p>لا يوجد زر حذف؛ كل مهمة تظل محفوظة ضمن شهرها.</p></div>
          <div className="filters" aria-label="تصفية المهام">
            {([[
              "all", "الكل",
            ], [
              "pending", "قيد المراجعة",
            ], [
              "approved", "معتمدة",
            ], [
              "rejected", "غير معتمدة",
            ]] as const).map(([value, label]) => (
              <button key={value} className={`filter-button${filter === value ? " is-active" : ""}`} type="button" onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="task-list" aria-live="polite">
          {loading ? (
            <><div className="loading-card" /><div className="loading-card" /></>
          ) : visibleTasks.length ? (
            visibleTasks.map((task) => {
              const date = dateParts(task.taskDate);
              return (
                <article className="task-card" data-status={task.status} key={task.id}>
                  <div className="date-tile"><div><strong>{date.day}</strong><span>{date.month}</span></div></div>
                  <div className="task-body">
                    <h3>{task.title}</h3>
                    {task.details && <p>{task.details}</p>}
                    <div className="task-meta">سُجلت {createdTime(task.createdAt)}{task.reviewer && ` · آخر مراجعة بواسطة ${task.reviewer}`}</div>
                  </div>
                  <button className={`status-button ${task.status}`} type="button" onClick={() => approvalClick(task.id)} aria-label={`${statusCopy[task.status]} — اضغط لتغيير حالة الاعتماد`}>
                    {statusCopy[task.status]}
                  </button>
                </article>
              );
            })
          ) : (
            <div className="empty-card">
              <div className="empty-symbol" aria-hidden="true">✓</div>
              <h3>لا توجد مهام هنا بعد</h3>
              <p>{filter === "all" ? "أضف أول إنجاز لهذا الشهر من النموذج بالأعلى." : "لا توجد مهام بهذه الحالة."}</p>
            </div>
          )}
        </div>

        <footer className="footer-note">
          <span>سجل تمهيد اليومي · الحفظ دائم والشهور مؤرشفة</span>
          <span>{supervisor ? "يمكنك إضافة مهام جديدة" : "الاعتماد متاح للجميع · الإضافة تتطلب الدخول"}</span>
        </footer>
      </section>

      {loginOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
            <div className="modal-header">
              <div><h2 id="login-title">تسجيل الدخول</h2><p>إضافة المهام الجديدة تتطلب تسجيل الدخول. تغيير حالة الاعتماد متاح للجميع.</p></div>
              <button className="close-button" type="button" aria-label="إغلاق" onClick={() => setLoginOpen(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={login}>
              <div className="field"><label htmlFor="username">اسم المستخدم</label><input id="username" name="username" autoComplete="username" required /></div>
              <div className="field"><label htmlFor="password">كلمة المرور</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
              <div className="modal-error" data-login-error role="alert" />
              <button className="teal-button" type="submit">دخول لإضافة المهام</button>
            </form>
          </section>
        </div>
      )}

      {monthOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="month-title">
            <div className="modal-header">
              <div><h2 id="month-title">إضافة شهر جديد</h2><p>عند فتحه، يظل كل ما سبق محفوظًا داخل قائمة الأرشيف.</p></div>
              <button className="close-button" type="button" aria-label="إغلاق" onClick={() => setMonthOpen(false)}>×</button>
            </div>
            <form onSubmit={addMonth}>
              <label className="field" htmlFor="new-month"><span>اختر الشهر</span></label>
              <input id="new-month" className="month-input" type="month" value={newMonth} onChange={(event) => setNewMonth(event.target.value)} required />
              <div className="month-modal-actions"><button className="gold-button" type="submit">فتح الشهر</button><button className="ghost-button" type="button" onClick={() => setMonthOpen(false)}>إلغاء</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
