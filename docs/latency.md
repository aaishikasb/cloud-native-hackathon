# Index-check latency experiment

Agent0 identified repeated index checks and writes as latency contributors in the onboarding traces. The application previously checked both indices before every search, profile operation, invitation operation, and readiness query. The checks ran in parallel, but added a network round trip before the useful operation.

`ensureIndices()` now shares an in-flight initialization within one process and caches successful checks for 60 seconds, keyed by Elasticsearch URL and API key. Failed initialization is not cached. A failed required Elasticsearch request invalidates the cached checks, so a missing index is checked and recreated on the next request; otherwise checks expire within a minute. Optional missing documents remain ordinary missing results. Readiness still performs a real Elasticsearch search every time. Write visibility (`refresh=wait_for`) and optimistic concurrency are unchanged.

## Controlled live comparison

Measured on **2026-11-09 at 22:43:38 UTC**, using Node **24.22.1** on the development laptop against the configured Elasticsearch Serverless project. Each variant ran ten times per operation, alternating order after warming connections. The baseline reproduces the previous two HEAD checks before the same application operation; the changed variant uses the warm cache. This measures application functions and live Elasticsearch requests, not the public HTTP route or Kubernetes pod.

| Operation | Previous checks: median (range) | Cached checks: median (range) | ES requests per call |
| --- | --- | --- | --- |
| Readiness | 414 ms (273–925 ms) | 181 ms (122–493 ms) | 3 → 1 |
| Anonymous network | 1,218 ms (285–5,337 ms) | 238 ms (127–394 ms) | 3 → 1 |

The observed reduction in request count is deterministic for warm calls within the cache interval. The timing sample is small and variable, including a 5.3-second baseline outlier; it does not establish a production latency guarantee or a general percentage speedup. Cold starts and cache expiry still check both indices. With a readiness probe every ten seconds, initialization HEAD requests drop from roughly twelve per minute per pod to roughly two; the six real readiness searches remain.

A repeat at **22:47:30 UTC**, after event access was configured, exercised the signed-cookie path with the same ten alternating samples per variant. Readiness medians were **232 → 120 ms** (ranges 189–301 and 95–195 ms); anonymous network medians were **256 → 104 ms** (ranges 196–671 and 90–176 ms). Both retained exactly **3 → 1 requests per call**. The difference between runs reinforces that the request-count reduction is more reliable evidence than a particular latency percentage.

Run the read-only comparison with Node 24:

```sh
node --env-file=.env.local scripts/measure-elasticsearch-latency.ts
```

The script permits only index-existence HEADs and search reads, and blocks index creation or other writes. When event access is configured, it uses the configured Cloud Native Hackathon code to generate a signed cookie in memory through the application's normal grant function; it does not bypass or change access policy. The anonymous network sample has event access but no attendee ownership cookie. It prints aggregate timing and request counts; it never prints credentials, cookies, response documents, profile content, or invitation links. It asserts valid event access, the expected 3-versus-1 request counts, and successful operation results. If indices are absent or the comparison crosses cache expiry, it fails instead of silently reporting an invalid comparison.

Focused regressions cover simultaneous initialization, cache expiry, event-field mappings on new indices, failed initialization retry, changed credentials, real readiness queries, missing-index recovery, and ordinary missing documents.

## Write deadline follow-up

During the local rendered check, creating a Text first invitation returned HTTP 503. A narrowly scoped Elastic CLI read then found exactly one committed invitation for that temporary host/member pair, created at **23:04:05.898 UTC**, with its meeting plan present. The write had succeeded despite the unsuccessful response. Other observed local write flows took roughly 13–16 seconds overall; those request totals include multiple Elasticsearch operations.

Elasticsearch PUT and DELETE requests now have a **30-second** deadline so `refresh=wait_for` has more time to complete. Document reads, HEAD checks, and search POSTs retain their **10-second** deadline. Write visibility and optimistic concurrency are preserved. A focused regression asserts these separate deadlines. The UI refreshes invitations after a failed create and asks the attendee to check My detours before creating another; it does not automatically retry the write.

A longer deadline cannot guarantee an unambiguous result: a write can still commit before a later timeout or network failure. The recovered invitation was reused for verification instead of creating a duplicate. This observation supports the deadline change, not a claim that all serverless write latency has been eliminated.

## Event mapping prerequisite

New indices include an `eventId` keyword on both people and invitations. Existing strict indices require this additive migration **before deploying event-aware writes**; request-time initialization deliberately does not modify existing mappings:

```http
PUT /detour-people,detour-invites/_mapping
Content-Type: application/json

{"properties":{"eventId":{"type":"keyword"}}}
```

Apply through the official Elastic CLI using an authorized administrative connection, then verify both mappings. This migration does not backfill existing documents; the event-aware backend treats missing `eventId` as Cloud Native Hackathon. The benchmark did not apply this migration or write any cloud data.
