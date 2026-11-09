import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_EVENT_ID, events, getEventId } from "../lib/events.ts";

test("conference selection defaults only when absent and rejects unknown events", () => {
  assert.equal(getEventId(), DEFAULT_EVENT_ID);
  assert.equal(getEventId(null), DEFAULT_EVENT_ID);
  for (const event of events) assert.equal(getEventId(event.id), event.id);
  assert.equal(getEventId(""), null);
  assert.equal(getEventId("another-conference"), null);
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
});
