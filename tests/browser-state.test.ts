import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBrowserState,
  serializeBrowserState,
} from "../lib/browser-state.ts";
import { defaultProfile } from "../lib/detour.ts";

test("saving bookmarks before a draft is selected cannot restore a sample as a draft", () => {
  const stored = serializeBrowserState(null, ["circle"]);
  assert.deepEqual(parseBrowserState(stored), {
    profile: null,
    saved: ["circle"],
  });
  assert.equal(
    parseBrowserState(serializeBrowserState(null, [])).profile,
    null,
  );
});

test("explicit drafts and legacy saved introductions survive reload", () => {
  const profile = { ...defaultProfile, name: "Avery", available: false };
  assert.deepEqual(parseBrowserState(serializeBrowserState(profile, ["ben"])), {
    profile,
    saved: ["ben"],
  });
  // A legacy value equal to the sample may have been deliberately saved.
  assert.deepEqual(
    parseBrowserState(JSON.stringify({ profile: defaultProfile, saved: [] }))
      .profile,
    defaultProfile,
  );
});

test("storage validation drops malformed profiles and invalid bookmark IDs", () => {
  const result = parseBrowserState(
    JSON.stringify({
      profile: { ...defaultProfile, mode: "Unexpected mode" },
      saved: ["circle", "circle", "ben", null, 1, "../bad", "a".repeat(65)],
    }),
  );
  assert.deepEqual(result, { profile: null, saved: ["circle", "ben"] });
  assert.deepEqual(parseBrowserState(null), { profile: null, saved: [] });
  assert.deepEqual(parseBrowserState("null"), { profile: null, saved: [] });
  assert.throws(() => parseBrowserState("{broken"), SyntaxError);
});
