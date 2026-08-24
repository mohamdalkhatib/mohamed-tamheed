const githubPagesOrigin = "https://mohamdalkhatib.github.io";

function corsHeaders(request: Request, headers?: HeadersInit) {
  const result = new Headers(headers);
  if (request.headers.get("origin") === githubPagesOrigin) {
    result.set("access-control-allow-origin", githubPagesOrigin);
    result.set("vary", "Origin");
  }
  return result;
}

export function apiJson(request: Request, body: unknown, init: ResponseInit = {}) {
  const headers = corsHeaders(request, init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function apiOptions(request: Request, methods: string) {
  if (request.headers.get("origin") !== githubPagesOrigin) {
    return new Response(null, { status: 403 });
  }
  const headers = corsHeaders(request);
  headers.set("access-control-allow-methods", methods);
  headers.set("access-control-allow-headers", "Content-Type, Authorization");
  headers.set("access-control-max-age", "86400");
  return new Response(null, { status: 204, headers });
}
