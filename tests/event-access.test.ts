import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  eventAccessStatus,
  grantEventAccess,
  requireEventAccess,
} from "../lib/server/event-access.ts";
import { ApiError } from "../lib/server/http.ts";
import { GET, POST } from "../app/api/events/access/route.ts";

const origin = "https://detour.test";
const eventId = "cloud-native-hackathon";
const codes = {
  "cloud-native-hackathon": "test-code-123",
  "kubecon-na-2026": "second-code-456",
};
const request = new Request(`${origin}/api/network`);

function configure(t: TestContext) {
  const keys = ["EVENT_ACCESS_CODES", "APP_URL", "NODE_ENV"] as const;
  const previous = keys.map((key) => [key, process.env[key]] as const);
  Object.assign(process.env, {
    APP_URL: origin,
    EVENT_ACCESS_CODES: JSON.stringify(codes),
    NODE_ENV: "test",
  });
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: value });
    }
  });
}

function withCookie(cookie: string) {
  return new Request(request, { headers: { Cookie: cookie.split(";")[0] } });
}

function unlock(code: unknown, event = eventId, from = origin) {
  return POST(
    new Request(`${origin}/api/events/access?event=${event}`, {
      method: "POST",
      headers: { Origin: from, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  );
}

const hasStatus = (status: number) => (error: unknown) =>
  error instanceof ApiError && error.status === status;

test("event codes grant signed, scoped, expiring access without exposing the code", async (t) => {
  configure(t);
  assert.throws(() => requireEventAccess(request, eventId), hasStatus(403));
  const cookie = grantEventAccess(request, eventId, codes[eventId]);
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=43200; Secure$/);
  assert.ok(!cookie.includes(codes[eventId]));
  const granted = withCookie(cookie);
  assert.equal(eventAccessStatus(granted, eventId).granted, true);
  assert.equal(eventAccessStatus(granted, "kubecon-na-2026").granted, false);
  assert.equal(eventAccessStatus(withCookie(cookie.split(";")[0] + "x"), eventId).granted, false);

  const currentTime = Date.now();
  t.mock.method(Date, "now", () => currentTime + 13 * 60 * 60 * 1000);
  assert.equal(eventAccessStatus(granted, eventId).granted, false);
});

test("access routes reject wrong codes, wrong events and cross-origin changes", async (t) => {
  configure(t);
  for (const code of ["wrong-code", codes["kubecon-na-2026"], undefined, 42, "x".repeat(81)]) {
    const rejected = await unlock(code);
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get("Set-Cookie"), null);
    assert.doesNotMatch(await rejected.text(), /test-code-123|second-code-456/);
  }
  const unlocked = await unlock(codes["kubecon-na-2026"], "kubecon-na-2026");
  assert.equal(unlocked.status, 200);
  assert.deepEqual(await unlocked.json(), { required: true, granted: true });
  assert.equal((await GET(new Request(`${origin}/api/events/access?event=unknown`))).status, 400);
  assert.equal((await unlock(codes[eventId], eventId, "https://other.test")).status, 403);
});

test("missing production configuration and malformed event configuration fail closed", async (t) => {
  configure(t);
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.EVENT_ACCESS_CODES;
  assert.throws(() => eventAccessStatus(request, eventId), hasStatus(503));
  assert.equal((await GET(new Request(`${origin}/api/events/access`))).status, 503);
  assert.equal((await unlock(codes[eventId])).status, 503);

  for (const invalid of ["malformed", "[]", "{}", JSON.stringify({ [eventId]: "        " })]) {
    process.env.EVENT_ACCESS_CODES = invalid;
    assert.throws(() => eventAccessStatus(request, eventId), hasStatus(503));
  }
  delete process.env.EVENT_ACCESS_CODES;
  Object.assign(process.env, { NODE_ENV: "development" });
  assert.deepEqual(eventAccessStatus(request, eventId), { required: false, granted: true });
});

test("rotating one event code revokes its existing cookie without changing the other event", (t) => {
  configure(t);
  const hackathon = withCookie(grantEventAccess(request, eventId, codes[eventId]));
  const kubecon = withCookie(grantEventAccess(request, "kubecon-na-2026", codes["kubecon-na-2026"]));
  const rotated = "replacement-code-789";
  process.env.EVENT_ACCESS_CODES = JSON.stringify({ ...codes, [eventId]: rotated });
  assert.equal(eventAccessStatus(hackathon, eventId).granted, false);
  assert.equal(eventAccessStatus(kubecon, "kubecon-na-2026").granted, true);
  assert.throws(() => grantEventAccess(request, eventId, codes[eventId]), hasStatus(403));
  const renewed = withCookie(grantEventAccess(request, eventId, rotated));
  assert.equal(eventAccessStatus(renewed, eventId).granted, true);
});
