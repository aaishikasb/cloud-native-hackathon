import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { elastic, ensureIndices } from "../lib/server/elasticsearch.ts";
import { ApiError } from "../lib/server/http.ts";
import { networkReady } from "../lib/server/network.ts";

let connectionNumber = 0;
function fakeIndices(t: TestContext, initiallyPresent = true) {
  const previousUrl = process.env.ELASTICSEARCH_URL;
  const previousKey = process.env.ELASTICSEARCH_API_KEY;
  process.env.ELASTICSEARCH_URL = `https://indices-${++connectionNumber}.example.test`;
  process.env.ELASTICSEARCH_API_KEY = "test-only";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.ELASTICSEARCH_URL;
    else process.env.ELASTICSEARCH_URL = previousUrl;
    if (previousKey === undefined) delete process.env.ELASTICSEARCH_API_KEY;
    else process.env.ELASTICSEARCH_API_KEY = previousKey;
  });
  const indices = new Set(initiallyPresent ? ["detour-people", "detour-invites"] : []);
  const calls: {
    method: string;
    index: string;
    body?: { mappings?: { properties?: Record<string, unknown> } };
  }[] = [];
  let failHeads = false;
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const [index, action] = new URL(input).pathname.slice(1).split("/");
    const method = init.method!;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, index, body });
    if (method === "HEAD")
      return new Response(null, { status: failHeads ? 503 : indices.has(index) ? 200 : 404 });
    if (method === "PUT" && !action) {
      indices.add(index);
      return Response.json({ acknowledged: true });
    }
    if (method === "POST" && action === "_search")
      return Response.json({ hits: { hits: [] } }, { status: indices.has(index) ? 200 : 404 });
    throw new Error("Unexpected fake Elasticsearch operation");
  });
  return { indices, calls, failHeads: (value: boolean) => { failHeads = value; } };
}

test("index initialization coalesces concurrent callers, expires, and creates event mappings", async (t) => {
  const store = fakeIndices(t, false);
  let now = 1_000;
  t.mock.method(Date, "now", () => now);
  await Promise.all(Array.from({ length: 12 }, () => ensureIndices()));
  assert.equal(store.calls.filter((call) => call.method === "HEAD").length, 2);
  const creates = store.calls.filter((call) => call.method === "PUT");
  assert.equal(creates.length, 2);
  for (const create of creates)
    assert.deepEqual(create.body?.mappings?.properties?.eventId, { type: "keyword" });
  await ensureIndices();
  assert.equal(store.calls.length, 4);
  now += 60_001;
  await Promise.all([ensureIndices(), ensureIndices()]);
  assert.equal(store.calls.filter((call) => call.method === "HEAD").length, 4);
});

test("failed initialization is retried instead of cached", async (t) => {
  const store = fakeIndices(t);
  store.failHeads(true);
  await assert.rejects(ensureIndices(), (error: unknown) => error instanceof ApiError && error.status === 503);
  store.failHeads(false);
  await ensureIndices();
  assert.equal(store.calls.filter((call) => call.method === "HEAD").length, 4);
  await ensureIndices();
  assert.equal(store.calls.length, 4);
});

test("readiness still queries Elasticsearch and a missing index invalidates cached checks", async (t) => {
  const store = fakeIndices(t);
  await ensureIndices();
  assert.deepEqual(await networkReady(), { status: "ready" });
  assert.deepEqual(await networkReady(), { status: "ready" });
  assert.equal(store.calls.filter((call) => call.method === "HEAD").length, 2);
  assert.equal(store.calls.filter((call) => call.method === "POST").length, 2);
  store.indices.delete("detour-people");
  await assert.rejects(networkReady(), (error: unknown) => error instanceof ApiError && error.status === 503);
  assert.deepEqual(await networkReady(), { status: "ready" });
  assert.equal(store.calls.filter((call) => call.method === "PUT").length, 1);
  assert.equal(store.calls.filter((call) => call.method === "HEAD").length, 4);
});

test("changed credentials recheck indices and invalid configuration cannot reuse success", async (t) => {
  const store = fakeIndices(t);
  await ensureIndices();
  process.env.ELASTICSEARCH_API_KEY = "different-test-only-key";
  await ensureIndices();
  assert.equal(store.calls.length, 4);
  delete process.env.ELASTICSEARCH_API_KEY;
  await assert.rejects(ensureIndices(), (error: unknown) => error instanceof ApiError && error.status === 503);
});

test("transport failures preserve the original error and trigger fresh index checks", async (t) => {
  const store = fakeIndices(t);
  await ensureIndices();
  const workingFetch = globalThis.fetch;
  const failure = new Error("private transport detail");
  t.mock.method(globalThis, "fetch", async () => { throw failure; });
  await assert.rejects(networkReady(), (error: unknown) => error === failure);
  t.mock.method(globalThis, "fetch", workingFetch);
  assert.deepEqual(await networkReady(), { status: "ready" });
  assert.equal(store.calls.filter((call) => call.method === "HEAD").length, 4);
});

test("a missing optional document remains missing without discarding successful index checks", async (t) => {
  const store = fakeIndices(t);
  await ensureIndices();
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  assert.equal(await elastic("detour-invites/_doc/missing", "GET", undefined, true), null);
  await ensureIndices();
  assert.equal(store.calls.length, 2);
});

test("writes allow refresh time while search and document reads keep their shorter deadline", async (t) => {
  fakeIndices(t);
  const deadlines: number[] = [];
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    deadlines.push(milliseconds);
    return new AbortController().signal;
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({}));
  await elastic("detour-invites/_doc/test?refresh=wait_for&if_seq_no=1&if_primary_term=1", "PUT", {});
  await elastic("detour-people/_doc/test?refresh=wait_for", "DELETE");
  await elastic("detour-people/_search", "POST", { size: 0 });
  await elastic("detour-invites/_doc/test");
  assert.deepEqual(deadlines, [30_000, 30_000, 10_000, 10_000]);
});
