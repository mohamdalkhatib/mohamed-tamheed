import {
  createSupervisorSession,
  destroySupervisorSession,
  expiredSessionCookie,
  isSupervisor,
  sessionCookie,
  verifySupervisorPassword,
} from "@/lib/supervisor-auth";
import { apiJson, apiOptions } from "@/lib/api-response";

export function OPTIONS(request: Request) {
  return apiOptions(request, "GET, POST, DELETE, OPTIONS");
}

export async function GET(request: Request) {
  try {
    return apiJson(request, { authenticated: await isSupervisor(request) });
  } catch {
    return apiJson(request, { authenticated: false });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string; password?: string };
    const username = payload.username?.trim() ?? "";
    const password = payload.password ?? "";
    if (username !== "Mizo" || !(await verifySupervisorPassword(password))) {
      return apiJson(request, { error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    const session = await createSupervisorSession();
    return apiJson(
      request,
      { authenticated: true, token: session.token, expiresAt: session.expiresAt },
      { headers: { "set-cookie": sessionCookie(request, session.token, session.expiresAt) } },
    );
  } catch (error) {
    return apiJson(request, { error: error instanceof Error ? error.message : "تعذر تسجيل الدخول" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  await destroySupervisorSession(request).catch(() => undefined);
  return apiJson(request, { authenticated: false }, { headers: { "set-cookie": expiredSessionCookie(request) } });
}
