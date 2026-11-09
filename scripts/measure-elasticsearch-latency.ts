import assert from "node:assert/strict";
import { DEFAULT_EVENT_ID } from "../lib/events.ts";
import { elastic, ensureIndices, PEOPLE_INDEX, INVITES_INDEX } from "../lib/server/elasticsearch.ts";
import { eventAccessStatus, grantEventAccess } from "../lib/server/event-access.ts";
import { getNetwork, networkReady } from "../lib/server/network.ts";

// Run with Node 24: node --env-file=.env.local scripts/measure-elasticsearch-latency.ts
// This guard makes the experiment read-only even if an index is unexpectedly absent.
const originalFetch = globalThis.fetch;
let requests = 0;
globalThis.fetch = async (input, init) => {
  const path = new URL(String(input)).pathname;
  const method = init?.method ?? "GET";
  const allowed = /^\/(detour-people|detour-invites)(?:\/_search)?$/.test(path)
    && ((method === "HEAD" && !path.endsWith("/_search"))
      || (method === "POST" && path.endsWith("/_search")));
  assert.ok(allowed, "Measurement allows only index existence and search reads");
  requests++;
  return originalFetch(input, init);
};

type Sample = { ms: number; requests: number };
const results: Record<string, Record<string, Sample[]>> = {};
async function measure(operation: () => Promise<void>, uncached: boolean): Promise<Sample> {
  const before = requests;
  const start = performance.now();
  if (uncached)
    await Promise.all([PEOPLE_INDEX, INVITES_INDEX].map((index) => elastic(index, "HEAD")));
  await operation();
  const sample = { ms: performance.now() - start, requests: requests - before };
  assert.equal(sample.requests, uncached ? 3 : 1);
  assert.ok(Number.isFinite(sample.ms) && sample.ms >= 0);
  return sample;
}

try {
  await ensureIndices();
  let networkRequest = new Request(`https://detour.example.test/api/network?event=${DEFAULT_EVENT_ID}`);
  if (eventAccessStatus(networkRequest, DEFAULT_EVENT_ID).required) {
    const codes = JSON.parse(process.env.EVENT_ACCESS_CODES!);
    const cookie = grantEventAccess(networkRequest, DEFAULT_EVENT_ID, codes[DEFAULT_EVENT_ID]);
    networkRequest = new Request(networkRequest, { headers: { Cookie: cookie.split(";")[0] } });
  }
  assert.equal(eventAccessStatus(networkRequest, DEFAULT_EVENT_ID).granted, true);
  const operations = {
    readiness: async () => { assert.equal((await networkReady()).status, "ready"); },
    anonymous_network: async () => {
      const result = await getNetwork(networkRequest);
      assert.equal(result.mode, "connected");
    },
  };
  for (const [name, operation] of Object.entries(operations)) {
    await operation();
    const samples = { previous_checks: [] as Sample[], cached_checks: [] as Sample[] };
    for (let trial = 0; trial < 10; trial++) {
      // Alternate the order so connection warming is not assigned to one variant.
      for (const uncached of trial % 2 === 0 ? [true, false] : [false, true])
        samples[uncached ? "previous_checks" : "cached_checks"].push(await measure(operation, uncached));
    }
    results[name] = samples;
  }
  const summary = Object.fromEntries(Object.entries(results).map(([name, variants]) => [name,
    Object.fromEntries(Object.entries(variants).map(([variant, samples]) => {
      const times = samples.map((sample) => sample.ms).sort((a, b) => a - b);
      return [variant, {
        samples: samples.length,
        requests: samples.reduce((total, sample) => total + sample.requests, 0),
        min_ms: Math.round(times[0]),
        median_ms: Math.round((times[4] + times[5]) / 2),
        max_ms: Math.round(times.at(-1)!),
      }];
    })),
  ]));
  console.log(JSON.stringify({ measured_at: new Date().toISOString(), summary }, null, 2));
} catch {
  console.error("Read-only latency measurement failed; no credentials or response data were printed.");
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
}
