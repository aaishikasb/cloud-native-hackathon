import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { defaultProfile } from "../lib/detour.ts";
import { DEFAULT_EVENT_ID, type EventId } from "../lib/events.ts";
import {
  ApiError,
  guestCookie,
  parseProfile,
  readJson,
  requireSameOrigin,
} from "../lib/server/http.ts";
import {
  assertOpen,
  networkReady,
  parseInvitation,
} from "../lib/server/network.ts";
import { GET as network } from "../app/api/network/route.ts";
import {
  POST as publish,
  DELETE as withdraw,
} from "../app/api/profile/route.ts";
import { POST as create, GET as list } from "../app/api/invitations/route.ts";
import { GET as invitation } from "../app/api/invitations/[id]/route.ts";
import { POST as accept } from "../app/api/invitations/[id]/accept/route.ts";

const origin = "https://detour.example.test";
const context = (id: string) => ({ params: Promise.resolve({ id }) });
function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let elasticInstance = 0;
function fakeElastic(t: TestContext) {
  const previous = {
    url: process.env.ELASTICSEARCH_URL,
    key: process.env.ELASTICSEARCH_API_KEY,
    app: process.env.APP_URL,
    codes: process.env.EVENT_ACCESS_CODES,
  };
  const elasticOrigin = `https://elastic-${++elasticInstance}.example.test`;
  process.env.ELASTICSEARCH_URL = elasticOrigin;
  process.env.ELASTICSEARCH_API_KEY = "test-only-not-a-real-key";
  process.env.APP_URL = origin;
  delete process.env.EVENT_ACCESS_CODES;
  t.after(() => {
    for (const [key, value] of [
      ["ELASTICSEARCH_URL", previous.url],
      ["ELASTICSEARCH_API_KEY", previous.key],
      ["APP_URL", previous.app],
      ["EVENT_ACCESS_CODES", previous.codes],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  });
  type Stored = {
    _source: Record<string, unknown>;
    _seq_no: number;
    _primary_term: number;
  };
  const indices = new Map<string, Map<string, Stored>>();
  const failedMembers = new Set<string>();
  let conflicts = 0;
  const calls: { path: string; body: Record<string, unknown> | undefined }[] =
    [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      assert.equal(url.origin, elasticOrigin);
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        "ApiKey test-only-not-a-real-key",
      );
      const [index, action, id] = url.pathname.slice(1).split("/");
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ path: url.pathname, body });
      const docs = indices.get(index);
      const json = (data: unknown, status = 200) =>
        Response.json(data, { status });
      if (init.method === "HEAD")
        return new Response(null, { status: docs ? 200 : 404 });
      if (!action && init.method === "PUT") {
        indices.set(index, new Map());
        return json({ acknowledged: true });
      }
      if (!docs) return json({ error: "index_not_found" }, 404);
      if (action === "_search") {
        type Filter = {
          term?: Record<string, unknown>;
          exists?: { field: string };
          range?: { expiresAt?: unknown };
          bool?: { filter?: Filter[]; should?: Filter[]; must_not?: Filter[] };
        };
        const matches = (
          source: Record<string, unknown>,
          filter: Filter,
        ): boolean => {
          if (filter.term) {
            const [key, expected] = Object.entries(filter.term)[0];
            return Array.isArray(source[key])
              ? source[key].includes(expected)
              : source[key] === expected;
          }
          if (filter.exists) return source[filter.exists.field] !== undefined;
          if (filter.range?.expiresAt)
            return Date.parse(String(source.expiresAt)) > Date.now();
          if (filter.bool) {
            return (
              (filter.bool.filter ?? []).every((item) => matches(source, item)) &&
              (filter.bool.must_not ?? []).every((item) => !matches(source, item)) &&
              (!filter.bool.should ||
                filter.bool.should.some((item) => matches(source, item)))
            );
          }
          return true;
        };
        let hits = [...docs]
          .map(([key, value]) => ({ _id: key, ...value }))
          .filter((hit) => matches(hit._source, body.query ?? {}));
        if (body.sort?.[0]?.createdAt === "desc")
          hits.sort((a, b) =>
            String(b._source.createdAt).localeCompare(
              String(a._source.createdAt),
            ),
          );
        return json({ hits: { hits: hits.slice(0, body.size ?? 10) } });
      }
      if (action === "_mget") {
        assert.deepEqual(Object.keys(body), ["ids"]);
        assert.equal(
          url.searchParams.get("_source"),
          "eventId,name,offer,ask,mode,available,topic,role,location",
        );
        return json({
          docs: body.ids.map((key: string) =>
            failedMembers.has(key)
              ? { _id: key, error: { reason: "private shard diagnostic" } }
              : docs.has(key)
                ? { _id: key, ...docs.get(key), found: true }
                : { _id: key, found: false },
          ),
        });
      }
      if (action === "_doc") {
        const stored = docs.get(id);
        if (init.method === "GET")
          return stored
            ? json({ _id: id, ...stored, found: true })
            : json({ found: false }, 404);
        if (
          url.searchParams.has("if_seq_no") &&
          Number(url.searchParams.get("if_seq_no")) !== stored?._seq_no
        ) {
          conflicts++;
          return json({ error: "version_conflict" }, 409);
        }
        if (init.method === "DELETE") {
          docs.delete(id);
          return json({ result: "deleted" });
        }
        if (init.method === "PUT") {
          if (url.searchParams.get("op_type") === "create" && stored)
            return json({ error: "version_conflict" }, 409);
          docs.set(id, {
            _source: body,
            _seq_no: (stored?._seq_no ?? -1) + 1,
            _primary_term: 1,
          });
          return json({ result: stored ? "updated" : "created" });
        }
      }
      throw new Error(
        `Unexpected mock request: ${init.method} ${url.pathname}`,
      );
    },
  );
  return {
    indices,
    failedMembers,
    calls,
    get conflicts() {
      return conflicts;
    },
  };
}

async function register(
  name: string,
  eventId: EventId = DEFAULT_EVENT_ID,
  existingCookie?: string,
) {
  const response = await publish(
    request(
      `/api/profile?event=${eventId}`,
      "POST",
      { ...defaultProfile, name },
      existingCookie,
    ),
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get("Set-Cookie")!;
  assert.match(cookie, /HttpOnly; SameSite=Lax/);
  assert.match(cookie, /; Secure$/);
  const data = await response.json();
  assert.equal(data.token, undefined);
  return { ...data, cookie: cookie.split(";")[0] } as {
    id: string;
    cookie: string;
  };
}

test("trust boundaries reject malformed profiles, cross-origin writes, and oversized JSON", async () => {
  assert.throws(
    () => parseProfile({ ...defaultProfile, available: "yes" }),
    ApiError,
  );
  assert.throws(() => parseProfile(null), ApiError);
  assert.deepEqual(
    parseProfile({
      ...defaultProfile,
      name: " Alice ",
      ownerHash: "attacker",
      id: "someone-else",
    }),
    { ...defaultProfile, name: "Alice" },
  );
  assert.throws(
    () =>
      requireSameOrigin(
        new Request(`${origin}/api/profile`, {
          method: "POST",
          headers: { Origin: "https://other.example" },
        }),
      ),
    (e: unknown) => e instanceof ApiError && e.status === 403,
  );
  await assert.rejects(
    readJson(request("/api/profile", "POST", { text: "x".repeat(17_000) })),
    (e: unknown) => e instanceof ApiError && e.status === 413,
  );
  await assert.rejects(
    readJson(
      new Request(`${origin}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    ),
    (e: unknown) => e instanceof ApiError && e.status === 400,
  );
  assert.doesNotMatch(
    guestCookie("test", new Request("http://localhost:3000/")),
    /; Secure/,
  );
});

test("no configuration is explicit preview; partial or failed configuration never becomes preview", async (t) => {
  fakeElastic(t);
  delete process.env.ELASTICSEARCH_URL;
  delete process.env.ELASTICSEARCH_API_KEY;
  const preview = await network(request("/api/network"));
  assert.equal((await preview.json()).mode, "preview");
  process.env.ELASTICSEARCH_URL = "https://elastic.example.test";
  const incomplete = await network(request("/api/network"));
  assert.equal(incomplete.status, 503);
  assert.equal((await incomplete.json()).mode, undefined);
  process.env.ELASTICSEARCH_API_KEY = "test-only-not-a-real-key";
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("secret-diagnostic", { status: 500 }),
  );
  const broken = await network(request("/api/network"));
  assert.equal(broken.status, 503);
  assert.doesNotMatch(await broken.text(), /secret-diagnostic|test-only/);
});

test("profile ownership is cookie-bound and public results omit owner hashes", async (t) => {
  const store = fakeElastic(t);
  const alice = await register("Alice");
  const bob = await register("Bob");
  const changed = await publish(
    request(
      "/api/profile",
      "POST",
      { ...defaultProfile, name: "Alice updated", id: bob.id },
      alice.cookie,
    ),
  );
  assert.equal((await changed.json()).id, alice.id);
  const response = await network(
    request(
      "/api/network?q=Kubernetes&available=true",
      "GET",
      undefined,
      alice.cookie,
    ),
  );
  const data = await response.json();
  assert.equal(data.me.id, alice.id);
  assert.equal(data.people[0].id, bob.id);
  assert.equal(data.people[0].name, "Bob");
  assert.doesNotMatch(JSON.stringify(data), /ownerHash|detour_guest|test-only/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(
    store.calls.some(
      (call) =>
        call.path.endsWith("_search") &&
        JSON.stringify(call.body).includes("multi_match"),
    ),
  );
  const unauthenticated = await withdraw(request("/api/profile", "DELETE"));
  assert.equal(unauthenticated.status, 401);
  const deleted = await withdraw(
    request("/api/profile", "DELETE", undefined, alice.cookie),
  );
  assert.equal(deleted.status, 200);
  assert.equal(deleted.headers.get("Set-Cookie"), null);
  assert.equal(store.indices.get("detour-people")!.size, 1);
});

test("overlapping profile edits cannot overwrite each other or recreate a withdrawn profile", async (t) => {
  const store = fakeElastic(t);
  const alice = await register("Alice");
  const edits = await Promise.all(
    ["Alice one", "Alice two"].map((name) =>
      publish(
        request(
          "/api/profile",
          "POST",
          { ...defaultProfile, name },
          alice.cookie,
        ),
      ),
    ),
  );
  assert.deepEqual(edits.map((response) => response.status).sort(), [200, 409]);
  const race = await Promise.all([
    withdraw(request("/api/profile", "DELETE", undefined, alice.cookie)),
    publish(
      request(
        "/api/profile",
        "POST",
        { ...defaultProfile, name: "Alice stale" },
        alice.cookie,
      ),
    ),
  ]);
  assert.equal(race[0].status, 200);
  assert.equal(race[1].status, 409);
  assert.equal(store.indices.get("detour-people")!.size, 0);
  assert.ok(store.conflicts >= 2);
});

test("invitations require unique published members, availability, and matching preferences", async (t) => {
  fakeElastic(t);
  const alice = await register("Alice");
  const bob = await register("Bob");
  assert.throws(
    () => parseInvitation({ memberIds: [alice.id, alice.id] }, alice.id),
    ApiError,
  );
  assert.throws(
    () =>
      parseInvitation({ memberIds: [bob.id, "not-a-published-id"] }, alice.id),
    ApiError,
  );
  await publish(
    request(
      "/api/profile",
      "POST",
      { ...defaultProfile, name: "Bob", available: false },
      bob.cookie,
    ),
  );
  let response = await create(
    request(
      "/api/invitations",
      "POST",
      { memberIds: [alice.id, bob.id] },
      alice.cookie,
    ),
  );
  assert.equal(response.status, 409);
  await publish(
    request(
      "/api/profile",
      "POST",
      { ...defaultProfile, name: "Bob", mode: "Text first" },
      bob.cookie,
    ),
  );
  response = await create(
    request(
      "/api/invitations",
      "POST",
      { memberIds: [alice.id, bob.id] },
      alice.cookie,
    ),
  );
  assert.equal(response.status, 409);
});

test("concurrent acceptance preserves both people and repeated acceptance is idempotent", async (t) => {
  const store = fakeElastic(t);
  const alice = await register("Alice"),
    bob = await register("Bob"),
    cara = await register("Cara");
  const made = await create(
    request(
      "/api/invitations",
      "POST",
      { memberIds: [alice.id, bob.id, cara.id], meetingSpot: "Long table" },
      alice.cookie,
    ),
  );
  assert.equal(made.status, 201);
  const plan = await made.json();
  assert.deepEqual(plan.acceptedIds, [alice.id]);
  const responses = await Promise.all(
    [bob, cara].map((person) =>
      accept(
        request(
          `/api/invitations/${plan.id}/accept`,
          "POST",
          undefined,
          person.cookie,
        ),
        context(plan.id),
      ),
    ),
  );
  assert.ok(responses.every((response) => response.status === 200));
  assert.ok(
    store.conflicts >= 1,
    "the test must exercise a stale-version write",
  );
  const final = await invitation(
    request(`/api/invitations/${plan.id}`, "GET", undefined, bob.cookie),
    context(plan.id),
  );
  assert.deepEqual(
    new Set((await final.json()).acceptedIds),
    new Set([alice.id, bob.id, cara.id]),
  );
  const repeated = await accept(
    request(
      `/api/invitations/${plan.id}/accept`,
      "POST",
      undefined,
      bob.cookie,
    ),
    context(plan.id),
  );
  assert.equal((await repeated.json()).acceptedIds.length, 3);
  const mine = await list(
    request("/api/invitations", "GET", undefined, cara.cookie),
  );
  assert.equal((await mine.json()).invitations.length, 1);
});

test("invitation lists fetch unique members once while preserving order, withdrawal, expiry, and privacy", async (t) => {
  const store = fakeElastic(t);
  const alice = await register("Alice"),
    bob = await register("Bob"),
    cara = await register("Cara"),
    dan = await register("Dan");
  const memberGroups = [
    [alice.id, bob.id],
    [cara.id, alice.id],
    [bob.id, cara.id, alice.id],
    [alice.id, bob.id],
    [alice.id, dan.id],
  ];
  const ids: string[] = [];
  for (const [index, memberIds] of memberGroups.entries()) {
    const response = await create(
      request("/api/invitations", "POST", { memberIds }, alice.cookie),
    );
    assert.equal(response.status, 201);
    const invitation = await response.json();
    ids.push(invitation.id);
    store.indices.get("detour-invites")!.get(invitation.id)!._source.createdAt =
      new Date(index * 1000).toISOString();
  }
  store.indices.get("detour-invites")!.get(ids[3])!._source.expiresAt =
    new Date(0).toISOString();
  await withdraw(request("/api/profile", "DELETE", undefined, dan.cookie));
  store.calls.length = 0;
  const response = await list(
    request("/api/invitations", "GET", undefined, alice.cookie),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(
    data.invitations.map((item: { id: string }) => item.id),
    [ids[2], ids[1], ids[0]],
  );
  assert.deepEqual(
    data.invitations.map((item: { members: { id: string }[] }) =>
      item.members.map((member) => member.id),
    ),
    memberGroups.slice(0, 3).reverse(),
  );
  assert.ok(
    data.invitations.every(
      (item: { viewerId: string }) => item.viewerId === alice.id,
    ),
  );
  assert.doesNotMatch(JSON.stringify(data), /ownerHash|detour_guest|test-only/);
  const memberRequests = store.calls.filter((call) =>
    call.path.endsWith("/_mget"),
  );
  assert.equal(memberRequests.length, 1);
  const requestedIds = memberRequests[0].body!.ids as string[];
  assert.equal(requestedIds.length, 4);
  assert.deepEqual(
    new Set(requestedIds),
    new Set([alice.id, bob.id, cara.id, dan.id]),
  );

  store.failedMembers.add(bob.id);
  const partialFailure = await list(
    request("/api/invitations", "GET", undefined, alice.cookie),
  );
  assert.equal(partialFailure.status, 503);
  assert.doesNotMatch(
    await partialFailure.text(),
    /private shard diagnostic|ownerHash|test-only/,
  );
  const singleFailure = await invitation(
    request(`/api/invitations/${ids[0]}`),
    context(ids[0]),
  );
  assert.equal(singleFailure.status, 503);
  store.indices.get("detour-invites")!.clear();
  store.calls.length = 0;
  const empty = await list(
    request("/api/invitations", "GET", undefined, alice.cookie),
  );
  assert.deepEqual(await empty.json(), { invitations: [] });
  assert.equal(
    store.calls.filter((call) => call.path.endsWith("/_mget")).length,
    0,
  );
});

test("uninvited browsers cannot accept; expiry and withdrawn profiles invalidate invitations", async (t) => {
  const store = fakeElastic(t);
  const alice = await register("Alice"),
    bob = await register("Bob"),
    outsider = await register("Outsider");
  const made = await create(
    request(
      "/api/invitations",
      "POST",
      { memberIds: [alice.id, bob.id] },
      alice.cookie,
    ),
  );
  const plan = await made.json();
  const forbidden = await accept(
    request(
      `/api/invitations/${plan.id}/accept`,
      "POST",
      undefined,
      outsider.cookie,
    ),
    context(plan.id),
  );
  assert.equal(forbidden.status, 403);
  const anonymous = await accept(
    request(`/api/invitations/${plan.id}/accept`, "POST"),
    context(plan.id),
  );
  assert.equal(anonymous.status, 401);
  const doc = store.indices.get("detour-invites")!.get(plan.id)!;
  const oldExpiry = doc._source.expiresAt;
  doc._source.expiresAt = new Date(Date.now() - 1).toISOString();
  const expired = await invitation(
    request(`/api/invitations/${plan.id}`),
    context(plan.id),
  );
  assert.equal(expired.status, 410);
  assert.throws(
    () => assertOpen({ ...doc._source, expiresAt: "not-a-date" } as never),
    ApiError,
  );
  doc._source.expiresAt = oldExpiry;
  await withdraw(request("/api/profile", "DELETE", undefined, bob.cookie));
  const withdrawn = await invitation(
    request(`/api/invitations/${plan.id}`),
    context(plan.id),
  );
  assert.equal(withdrawn.status, 410);
});

test("conferences isolate introductions while preserving one browser's ownership across switching and withdrawal", async (t) => {
  const store = fakeElastic(t);
  const alice = await register("Alice at the hackathon");
  const bob = await register("Bob at the hackathon");
  const kubeAlice = await register("Alice at KubeCon", "kubecon-na-2026", alice.cookie);
  const kubeBob = await register("Bob at KubeCon", "kubecon-na-2026");
  assert.equal(kubeAlice.cookie, alice.cookie);
  assert.notEqual(kubeAlice.id, alice.id);
  const hackathon = await (await network(request("/api/network", "GET", undefined, alice.cookie))).json();
  assert.equal(hackathon.eventId, DEFAULT_EVENT_ID);
  assert.equal(hackathon.me.id, alice.id);
  assert.deepEqual(hackathon.people.map((person: { id: string }) => person.id), [bob.id]);
  const kubecon = await (await network(request("/api/network?event=kubecon-na-2026", "GET", undefined, alice.cookie))).json();
  assert.equal(kubecon.me.id, kubeAlice.id);
  assert.deepEqual(kubecon.people.map((person: { id: string }) => person.id), [kubeBob.id]);
  const withdrawn = await withdraw(request("/api/profile?event=kubecon-na-2026", "DELETE", undefined, alice.cookie));
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.headers.get("Set-Cookie"), null);
  const stillOwned = await (await network(request("/api/network", "GET", undefined, alice.cookie))).json();
  assert.equal(stillOwned.me.id, alice.id);
  assert.equal(store.indices.get("detour-people")!.get(alice.id)!._source.eventId, DEFAULT_EVENT_ID);
  const unknown = await network(request("/api/network?event=unknown"));
  assert.equal(unknown.status, 400);
});

test("invitation reads, lists, creation, and acceptance cannot cross conference boundaries", async (t) => {
  fakeElastic(t);
  const alice = await register("Alice");
  const bob = await register("Bob");
  const kubeAlice = await register("Alice KubeCon", "kubecon-na-2026", alice.cookie);
  const kubeBob = await register("Bob KubeCon", "kubecon-na-2026", bob.cookie);
  const crossed = await create(request("/api/invitations", "POST", { memberIds: [alice.id, kubeBob.id] }, alice.cookie));
  assert.equal(crossed.status, 410);
  const made = await create(request("/api/invitations?event=kubecon-na-2026", "POST", { memberIds: [kubeAlice.id, kubeBob.id] }, alice.cookie));
  assert.equal(made.status, 201);
  const plan = await made.json();
  assert.equal(plan.eventId, "kubecon-na-2026");
  assert.equal((await invitation(request(`/api/invitations/${plan.id}`, "GET", undefined, bob.cookie), context(plan.id))).status, 404);
  assert.equal((await accept(request(`/api/invitations/${plan.id}/accept`, "POST", undefined, bob.cookie), context(plan.id))).status, 404);
  const wrongList = await (await list(request("/api/invitations", "GET", undefined, alice.cookie))).json();
  assert.deepEqual(wrongList.invitations, []);
  const rightList = await (await list(request("/api/invitations?event=kubecon-na-2026", "GET", undefined, alice.cookie))).json();
  assert.deepEqual(rightList.invitations.map((item: { id: string }) => item.id), [plan.id]);
  const accepted = await accept(request(`/api/invitations/${plan.id}/accept?event=kubecon-na-2026`, "POST", undefined, bob.cookie), context(plan.id));
  assert.equal(accepted.status, 200);
  assert.deepEqual(new Set((await accepted.json()).acceptedIds), new Set([kubeAlice.id, kubeBob.id]));
});

test("legacy introductions and invitations remain in the hackathon only", async (t) => {
  const store = fakeElastic(t);
  const alice = await register("Legacy Alice");
  const bob = await register("Legacy Bob");
  const plan = await (await create(request("/api/invitations", "POST", { memberIds: [alice.id, bob.id] }, alice.cookie))).json();
  for (const document of store.indices.get("detour-people")!.values()) delete document._source.eventId;
  delete store.indices.get("detour-invites")!.get(plan.id)!._source.eventId;
  const oldNetwork = await (await network(request("/api/network", "GET", undefined, alice.cookie))).json();
  assert.equal(oldNetwork.me.id, alice.id);
  assert.equal(oldNetwork.people[0].id, bob.id);
  const newNetwork = await (await network(request("/api/network?event=kubecon-na-2026", "GET", undefined, alice.cookie))).json();
  assert.equal(newNetwork.me, null);
  assert.deepEqual(newNetwork.people, []);
  const legacyInvite = await invitation(request(`/api/invitations/${plan.id}`, "GET", undefined, bob.cookie), context(plan.id));
  assert.equal(legacyInvite.status, 200);
  assert.equal((await legacyInvite.json()).eventId, DEFAULT_EVENT_ID);
  const otherEvent = await invitation(request(`/api/invitations/${plan.id}?event=kubecon-na-2026`, "GET", undefined, bob.cookie), context(plan.id));
  assert.equal(otherEvent.status, 404);
});

test("event access gates every attendee API before data access while readiness stays independent", async (t) => {
  const store = fakeElastic(t);
  process.env.EVENT_ACCESS_CODES = JSON.stringify({
    "cloud-native-hackathon": "test-hackathon-access",
    "kubecon-na-2026": "test-kubecon-access",
  });
  const id = "12345678-1234-1234-1234-123456789012";
  const responses = await Promise.all([
    network(request("/api/network")),
    publish(request("/api/profile", "POST", defaultProfile)),
    withdraw(request("/api/profile", "DELETE")),
    list(request("/api/invitations")),
    create(request("/api/invitations", "POST", { memberIds: [] })),
    invitation(request(`/api/invitations/${id}`), context(id)),
    accept(request(`/api/invitations/${id}/accept`, "POST"), context(id)),
  ]);
  assert.ok(responses.every((response) => response.status === 403));
  assert.equal(store.calls.length, 0);
  assert.deepEqual(await networkReady(), { status: "ready" });
});
