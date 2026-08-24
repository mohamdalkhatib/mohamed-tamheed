import {
  createSupervisorSession,
  destroySupervisorSession,
  expiredSessionCookie,
  isSupervisor,
  sessionCookie,
  verifySupervisorPassword,
} from "@/lib/supervisor-auth";

export async function GET(request: Request) {
  try {
    return Response.json({ authenticated: await isSupervisor(request) });
  } catch {
    return Response.json({ authenticated: false });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string; password?: string };
    const username = payload.username?.trim() ?? "";
    const password = payload.password ?? "";
    if (username !== "Mizo" || !(await verifySupervisorPassword(password))) {
      return Response.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    const session = await createSupervisorSession();
    return Response.json({ authenticated: true }, { headers: { "set-cookie": sessionCookie(request, session.token, session.expiresAt) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر تسجيل الدخول" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  await destroySupervisorSession(request).catch(() => undefined);
  return Response.json({ authenticated: false }, { headers: { "set-cookie": expiredSessionCookie(request) } });
}
