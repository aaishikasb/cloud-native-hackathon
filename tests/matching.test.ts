import assert from "node:assert/strict";
import test from "node:test";
import { defaultProfile, people, type Person } from "../lib/detour.ts";
import { findDetours, helpTopics } from "../lib/matching.ts";

const self: Person = {
  ...defaultProfile,
  id: "self",
  initials: "AA",
  role: "Attendee",
  color: "sage",
  topic: "AI & ML",
  location: "Coffee bar",
};

test("finds the sample reciprocal circle with evidence for every edge", () => {
  const result = findDetours(self, people);
  assert.deepEqual(
    result.circle?.map((person) => person.id),
    ["self", "cara", "ben"],
  );
  const circle = result.circle!;
  for (let i = 0; i < circle.length; i++) {
    assert.ok(
      helpTopics(circle[i].offer, circle[(i + 1) % circle.length].ask).length,
    );
  }
  assert.deepEqual(findDetours(self, [...people].reverse()), result);
});

test("uses current offers and asks instead of retaining the sample circle", () => {
  const changed = { ...self, offer: "Woodworking", ask: "Ceramics" };
  assert.deepEqual(findDetours(changed, people), { circle: null, pairs: [] });
  assert.equal(findDetours({ ...self, ask: "Ceramics" }, people).circle, null);
});

test("excludes unavailable attendees, self, and duplicate identities", () => {
  assert.deepEqual(findDetours({ ...self, available: false }, people), {
    circle: null,
    pairs: [],
  });
  const withoutBen = people.map((person) =>
    person.id === "ben" ? { ...person, available: false } : person,
  );
  assert.equal(findDetours(self, withoutBen).circle, null);
  const result = findDetours(self, [self, ...people, ...people]);
  assert.equal(
    new Set(result.pairs.map((person) => person.id)).size,
    result.pairs.length,
  );
  assert.ok(
    result.pairs.every((person) => person.id !== self.id && person.available),
  );
  assert.equal(new Set(result.circle?.map((person) => person.id)).size, 3);
});

test("keeps genuine one-way pair suggestions when a circle is unavailable", () => {
  const ben = people.find((person) => person.id === "ben")!;
  const result = findDetours(self, [ben]);
  assert.equal(result.circle, null);
  assert.deepEqual(
    result.pairs.map((person) => person.id),
    ["ben"],
  );
  assert.deepEqual(helpTopics(ben.offer, self.ask), ["kubernetes"]);
  assert.deepEqual(helpTopics(self.offer, ben.ask), []);
});

test("normalizes punctuation, common technical shorthand, and simple plurals", () => {
  assert.deepEqual(
    helpTopics(
      "MODELS, K8s & a11y",
      "model optimization, Kubernetes, accessibility",
    ),
    ["accessibility", "kubernetes", "model"],
  );
  assert.deepEqual(helpTopics("C++ and CSS", "C++ or CSS help"), [
    "c++",
    "css",
  ]);
  assert.deepEqual(
    helpTopics(
      "Can help with getting your first thing",
      "Looking for help getting my first thing",
    ),
    [],
  );
  assert.deepEqual(
    helpTopics(
      "Can help with getting your first",
      "Looking for help getting my first",
    ),
    [],
  );
  assert.deepEqual(findDetours(self, []), { circle: null, pairs: [] });
});

test("bounds candidate work and does not mutate the input", () => {
  const ben = people[0];
  const attendees = Array.from({ length: 101 }, (_, i) => ({
    ...ben,
    id: `person-${i}`,
  }));
  const original = structuredClone(attendees);
  const result = findDetours(self, attendees);
  assert.equal(result.pairs.length, 100);
  assert.ok(!result.pairs.some((person) => person.id === "person-100"));
  assert.deepEqual(attendees, original);
});
