import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildEventRequest,
  EventRequestError,
  eventRequestFilename,
  eventRequestGitHubUrl,
  eventRequestJson,
  eventRequestSlug,
  parseEventRequest,
  type EventRequestDraft,
} from "../lib/event-request.ts";

const draft: EventRequestDraft = {
  name: "Community Builders Summit",
  website: "https://example.org/summit?day=1&track=community",
  location: "Denver, Colorado",
  startDate: "2027-02-10",
  endDate: "2027-02-12",
  reason: "Attendees want to meet collaborators between sessions.",
};

test("builds a normalized request and preserves public details through JSON and GitHub URL encoding", () => {
  const request = buildEventRequest({ ...draft, name: `  ${draft.name}  ` });
  assert.equal(request.name, draft.name);
  assert.equal(request.slug, "community-builders-summit");
  assert.deepEqual(JSON.parse(eventRequestJson(request)), request);
  const url = new URL(eventRequestGitHubUrl(request));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/aaishikasb/cloud-native-hackathon/new/main");
  assert.equal(url.searchParams.get("filename"), "event-requests/community-builders-summit-2027-02-10.json");
  assert.deepEqual(JSON.parse(url.searchParams.get("value")!), request);
  assert.equal(url.searchParams.size, 2);
});

test("rejects missing/unknown fields and enforces every bounded text field", () => {
  const request = buildEventRequest(draft);
  for (const field of ["name", "website", "location", "reason"] as const) {
    assert.throws(() => parseEventRequest({ ...request, [field]: "   " }), EventRequestError);
  }
  for (const [field, limit] of Object.entries({ name: 100, website: 300, location: 120, reason: 400 })) {
    assert.throws(() => parseEventRequest({ ...request, [field]: "a".repeat(limit + 1) }), EventRequestError);
  }
  assert.throws(() => parseEventRequest({ ...request, accessCode: "not-allowed" }), /only the requested public/);
  assert.throws(() => parseEventRequest(null), EventRequestError);
  assert.throws(() => parseEventRequest([]), EventRequestError);
});

test("requires a public HTTPS website without embedded credentials", () => {
  for (const website of ["not a URL", "http://example.org", "javascript:alert(1)", "https://name:password@example.org", "https://localhost", "https://venue.local", "https://127.0.0.1"]) {
    assert.throws(() => buildEventRequest({ ...draft, website }), EventRequestError, website);
  }
});

test("validates actual calendar dates, order, and a same-day event", () => {
  for (const startDate of ["2027-02-29", "2027-13-01", "2027-01-32", "02/10/2027"]) {
    assert.throws(() => buildEventRequest({ ...draft, startDate }), EventRequestError, startDate);
  }
  assert.throws(() => buildEventRequest({ ...draft, endDate: "2027-02-09" }), /on or after/);
  assert.equal(buildEventRequest({ ...draft, endDate: draft.startDate }).endDate, draft.startDate);
  assert.equal(buildEventRequest({ ...draft, startDate: "2028-02-29", endDate: "2028-03-01" }).startDate, "2028-02-29");
});

test("keeps generated paths safe and rejects catalog duplicates or forged slugs", () => {
  assert.equal(eventRequestSlug("../Café & Community/2027"), "cafe-community-2027");
  assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventRequestSlug("a".repeat(300))));
  const request = buildEventRequest(draft);
  assert.throws(() => parseEventRequest({ ...request, slug: "../../other" }), /identifier/);
  assert.throws(() => eventRequestFilename({ ...request, slug: "valid-but-forged" }), /identifier/);
  assert.throws(() => buildEventRequest({ ...draft, name: "Cloud Native Hackathon" }), /already in Detour/);
  assert.throws(() => buildEventRequest({ ...draft, name: "KubeCon NA 2026" }), /already in Detour/);
});

test("all tracked pending event requests pass validation and have unique names and matching filenames", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const tracked = execFileSync("git", ["ls-files", "-z", "--", "event-requests"], { cwd: root, encoding: "utf8" })
    .split("\0").filter((path) => path.endsWith(".json"));
  const seen = new Set<string>();
  for (const filename of tracked) {
    const request = parseEventRequest(JSON.parse(readFileSync(new URL(`../${filename}`, import.meta.url), "utf8")));
    assert.equal(filename, eventRequestFilename(request), `${filename} must match its event identifier and start date`);
    assert.ok(!seen.has(request.slug), `${filename} duplicates another pending request`);
    seen.add(request.slug);
  }
});
