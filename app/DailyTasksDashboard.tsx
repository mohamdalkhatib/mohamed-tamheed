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

const githubPagesHost = "mohamdalkhatib.github.io";
const apiOrigin = "https://mohamed-tamheed.sore-arabic.chatgpt.site";
const sessionStorageKey = "tamheed-login-token";

function usesRemoteApi() {
  return typeof window !== "undefined" && window.location.hostname === githubPagesHost;
}

function savedSessionToken() {
  if (!usesRemoteApi()) return "";
  try {
    return window.localStorage.getItem(sessionStorageKey) ?? "";
  } catch {
    return "";
  }
}

function saveSessionToken(token?: string) {
  if (!usesRemoteApi()) return;
  try {
    if (token) window.localStorage.setItem(sessionStorageKey, token);
    else window.localStorage.removeItem(sessionStorageKey);
  } catch {
    // The page still works; the user will simply sign in again next time.
  }
}

function apiFetch(path: string, init: RequestInit = {}) {
  const remote = usesRemoteApi();
  const headers = new Headers(init.headers);
  const token = savedSessionToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(`${remote ? apiOrigin : ""}${path}`, {
    ...init,
    headers,
    credentials: remote ? "omit" : (init.credentials ?? "same-origin"),
  });
}

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
  const [deleting, setDeleting] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [supervisor, setSupervisor] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [monthOpen, setMonthOpen] = useState(false);
  const [newMonth, setNewMonth] = useState("");

  const openLogin = useCallback(() => {
    setLoginError("");
    setLoginOpen(true);
  }, []);

  const loadMonths = useCallback(async () => {
    const response = await apiFetch("/api/months", { cache: "no-store" });
    if (!response.ok) throw new Error("الشهور محملتش، جرّب تعمل تحديث.");
    const data = (await response.json()) as { months: Month[]; activeMonth: string };
    setMonths(data.months);
    setSelectedMonth((current) => current || data.activeMonth);
  }, []);

  const loadTasks = useCallback(async (monthKey: string) => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/tasks?month=${encodeURIComponent(monthKey)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("المهام محملتش، جرّب تعمل تحديث.");
      const data = (await response.json()) as { tasks: Task[] };
      setTasks(data.tasks);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حصلت مشكلة، جرّب تاني.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      Promise.resolve().then(loadMonths),
      apiFetch("/api/auth", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { authenticated?: boolean }) => setSupervisor(Boolean(data.authenticated)))
        .catch(() => setSupervisor(false)),
    ]).catch(() => setMessage("الصفحة موصلتش بقاعدة البيانات. جرّب تعمل تحديث."));
  }, [loadMonths]);

  useEffect(() => {
    if (selectedMonth) void Promise.resolve().then(() => loadTasks(selectedMonth));
  }, [selectedMonth, loadTasks]);

  const selectedMonthLabel =
    months.find((month) => month.monthKey === selectedMonth)?.label ?? "لحظة...";

  const visibleTasks = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((task) => task.status === filter)),
    [filter, tasks],
  );

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !selectedMonth) return;
    if (!supervisor) {
      openLogin();
      setMessage("سجّل دخول الأول عشان تضيف المهمة.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/tasks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          monthKey: selectedMonth,
          title: title.trim(),
          details: details.trim(),
          taskDate,
        }),
      });
      const data = (await response.json()) as { task?: Task; error?: string };
      if (response.status === 401) {
        setSupervisor(false);
        openLogin();
        throw new Error("الجلسة خلصت، سجّل دخول تاني.");
      }
      if (!response.ok || !data.task) throw new Error(data.error ?? "المهمة متحفظتش، جرّب تاني.");
      setTasks((current) => [data.task as Task, ...current]);
      setTitle("");
      setDetails("");
      setMessage("تمام، المهمة اتضافت.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "المهمة متحفظتش، جرّب تاني.");
    } finally {
      setSaving(false);
    }
  }

  async function setTaskStatus(taskId: number) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    try {
      const response = await apiFetch("/api/tasks/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: taskId, status: nextStatus[task.status] }),
      });
      const data = (await response.json()) as { task?: Task; error?: string };
      if (!response.ok || !data.task) throw new Error(data.error ?? "الاعتماد متغيرش، جرّب تاني.");
      setTasks((current) => current.map((item) => (item.id === taskId ? (data.task as Task) : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "الاعتماد متغيرش، جرّب تاني.");
    }
  }

  async function deleteTask(task: Task) {
    if (!supervisor) {
      openLogin();
      setMessage("سجّل دخول الأول عشان تحذف المهمة.");
      return;
    }
    if (!window.confirm(`متأكد إنك عايز تحذف «${task.title}»؟`)) return;
    setDeleting(task.id);
    setMessage("");
    try {
      const response = await apiFetch(`/api/tasks?id=${task.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { deleted?: boolean; error?: string };
      if (response.status === 401) {
        setSupervisor(false);
        openLogin();
        throw new Error("الجلسة خلصت، سجّل دخول تاني.");
      }
      if (!response.ok || !data.deleted) throw new Error(data.error ?? "المهمة متحذفتش، جرّب تاني.");
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setMessage("تمام، المهمة اتحذفت.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "المهمة متحذفتش، جرّب تاني.");
    } finally {
      setDeleting(null);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginBusy) return;
    const form = new FormData(event.currentTarget);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await apiFetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const data = (await response.json()) as { authenticated?: boolean; token?: string; error?: string };
      if (!response.ok || !data.authenticated) {
        setLoginError(data.error ?? "اليوزر أو الباسورد مش صح.");
        return;
      }
      saveSessionToken(data.token);
      setSupervisor(true);
      setLoginOpen(false);
      setMessage("تمام، سجلت دخول.");
    } catch (error) {
      setLoginError(error instanceof DOMException && error.name === "AbortError"
        ? "الدخول أخد وقت زيادة. جرّب تاني."
        : "الدخول مكملش. اتأكد من النت وجرّب تاني.");
    } finally {
      window.clearTimeout(timeout);
      setLoginBusy(false);
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/auth", { method: "DELETE" });
    } finally {
      saveSessionToken();
      setSupervisor(false);
      setMessage("تم تسجيل الخروج.");
    }
  }

  async function addMonth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMonth) return;
    try {
      const response = await apiFetch("/api/months", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ monthKey: newMonth }),
      });
      const data = (await response.json()) as { month?: Month; error?: string };
      if (!response.ok || !data.month) throw new Error(data.error ?? "الشهر متضافش، جرّب تاني.");
      await loadMonths();
      setSelectedMonth(data.month.monthKey);
      setNewMonth("");
      setMonthOpen(false);
      setMessage("تمام، الشهر اتضاف.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "الشهر متضافش، جرّب تاني.");
    }
  }

  return (
    <main className="app-shell">
      <section className="top-area">
        <div className="container">
          <header className="topbar">
            <div className="brand">
              <img src="https://tamheed.sa/wp-content/uploads/2025/12/logo.svg" alt="تمهيد" />
              <span className="brand-divider" aria-hidden="true" />
              <span className="brand-label">المهام اليومية</span>
            </div>
            <button
              className={`supervisor-button${supervisor ? " is-active" : ""}`}
              type="button"
              onClick={() => (supervisor ? void logout() : openLogin())}
            >
              <span className="supervisor-dot" aria-hidden="true" />
              {supervisor ? "خروج" : "دخول"}
            </button>
          </header>

          <div className="hero">
            <h1>أنا عملت إيه النهارده؟</h1>
            <p>اكتب اللي خلصته وسيبه للمراجعة.</p>
          </div>
        </div>
      </section>

      <section className="workspace container" aria-label="المهام">
        <div className="control-card">
          <div className="month-row">
            <div className="month-copy"><small>الشهر</small><h2>{selectedMonthLabel}</h2></div>
            <div className="month-actions">
              <select
                className="archive-select"
                aria-label="الشهور"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              >
                {months.map((month) => (
                  <option key={month.monthKey} value={month.monthKey}>{month.label}</option>
                ))}
              </select>
              <button className="ghost-button" type="button" onClick={() => setMonthOpen(true)}>+ شهر</button>
            </div>
          </div>

          <form className="composer" onSubmit={addTask}>
            <div className="field">
              <label htmlFor="task-title">المهمة</label>
              <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عملت إيه؟" maxLength={160} required />
            </div>
            <div className="field field-details">
              <label htmlFor="task-details">تفاصيل بسيطة (اختياري)</label>
              <textarea id="task-details" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="أي تفاصيل مهمة" maxLength={2000} />
            </div>
            <div className="field">
              <label htmlFor="task-date">التاريخ</label>
              <input id="task-date" type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} required />
            </div>
            <button className="gold-button" type="submit" disabled={saving || !selectedMonth}>{saving ? "لحظة..." : "+ إضافة"}</button>
          </form>
          {message && <div className="message" role="status">{message}</div>}
        </div>

        <div className="list-heading">
          <h2>المهام</h2>
          <div className="filters" aria-label="تصفية المهام">
            {([[
              "all", "الكل",
            ], [
              "pending", "مستنية",
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
                    <div className="task-meta">اتسجلت {createdTime(task.createdAt)}</div>
                  </div>
                  <div className="task-actions">
                    <button className={`status-button ${task.status}`} type="button" onClick={() => void setTaskStatus(task.id)} aria-label={`${statusCopy[task.status]} — اضغط لتغيير الاعتماد`}>
                      {statusCopy[task.status]}
                    </button>
                    <button className="delete-button" type="button" onClick={() => void deleteTask(task)} disabled={deleting === task.id} aria-label={`حذف مهمة ${task.title}`}>
                      {deleting === task.id ? "لحظة..." : "حذف"}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-card">
              <h3>لسه مفيش مهام</h3>
              <p>{filter === "all" ? "اكتب أول مهمة فوق." : "مفيش مهام بالحالة دي."}</p>
            </div>
          )}
        </div>
      </section>

      {loginOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
            <div className="modal-header">
              <div><h2 id="login-title">تسجيل الدخول</h2><p>لازم تسجل دخول عشان تضيف أو تحذف مهمة.</p></div>
              <button className="close-button" type="button" aria-label="إغلاق" onClick={() => !loginBusy && setLoginOpen(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={login}>
              <div className="field"><label htmlFor="username">اسم المستخدم</label><input id="username" name="username" autoComplete="username" defaultValue="Mizo" disabled={loginBusy} required /></div>
              <div className="field"><label htmlFor="password">كلمة المرور</label><input id="password" name="password" type="password" autoComplete="current-password" disabled={loginBusy} required /></div>
              {loginError && <div className="modal-error" role="alert">{loginError}</div>}
              <button className="teal-button" type="submit" disabled={loginBusy}>{loginBusy ? "لحظة..." : "دخول"}</button>
            </form>
          </section>
        </div>
      )}

      {monthOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="month-title">
            <div className="modal-header">
              <div><h2 id="month-title">شهر جديد</h2><p>الشهور القديمة هتفضل موجودة في القائمة.</p></div>
              <button className="close-button" type="button" aria-label="إغلاق" onClick={() => setMonthOpen(false)}>×</button>
            </div>
            <form onSubmit={addMonth}>
              <label className="field" htmlFor="new-month"><span>اختار الشهر</span></label>
              <input id="new-month" className="month-input" type="month" value={newMonth} onChange={(event) => setNewMonth(event.target.value)} required />
              <div className="month-modal-actions"><button className="gold-button" type="submit">إضافة الشهر</button><button className="ghost-button" type="button" onClick={() => setMonthOpen(false)}>إلغاء</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
