import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Arabic Tamheed task tracker", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="ar"[^>]+dir="rtl"/i);
  assert.match(html, /<title>المهام اليومية<\/title>/);
  assert.match(html, /مهام شركة تمهيد/);
  assert.match(html, /المهام اليومية/);
  assert.match(html, /عملت إيه؟/);
  assert.match(html, /\+ إضافة/);
  assert.doesNotMatch(html, /كل يوم موثّق|قاعدة بسيطة|نظام متابعة الإنجاز اليومي|سجل المهام الداخلية/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|SkeletonPreview/i);
});
