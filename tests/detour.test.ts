import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultProfile,
  filterPeople,
  people,
  validateProfile,
  type Profile,
} from "../lib/detour.ts";

test("search finds names, roles, offers, asks, and topics without case sensitivity", () => {
  for (const query of [
    "  BEN CARTER  ",
    "platform engineer",
    "KUBERNETES",
    "developer dashboard",
    "cloud native",
  ]) {
    assert.ok(
      filterPeople(people, query, "All people", false).some(
        (person) => person.id === "ben",
      ),
    );
  }
});

test("topic, availability, and query filters apply together", () => {
  assert.deepEqual(
    filterPeople(people, "", "Cloud native", true).map((person) => person.id),
    ["ben"],
  );
  assert.deepEqual(
    filterPeople(people, "traces", "Cloud native", false).map(
      (person) => person.id,
    ),
    ["jules"],
  );
  assert.deepEqual(filterPeople(people, "traces", "Cloud native", true), []);
  assert.deepEqual(filterPeople(people, "traces", "Design", false), []);
});

test("empty search returns all eligible attendees without mutating source data", () => {
  const originalOrder = people.map((person) => person.id);
  const result = filterPeople(people, "   ", "All people", false);
  assert.deepEqual(
    result.map((person) => person.id),
    originalOrder,
  );
  assert.notStrictEqual(result, people);
  result.reverse();
  assert.deepEqual(
    people.map((person) => person.id),
    originalOrder,
  );
});

test("unmatched searches and empty attendee lists produce an empty result", () => {
  assert.deepEqual(
    filterPeople(people, "underwater basket weaving", "All people", false),
    [],
  );
  assert.deepEqual(filterPeople([], "", "All people", false), []);
});

test("profile requires a name, offer, and ask with useful recovery messages", () => {
  assert.equal(validateProfile(defaultProfile), null);
  for (const field of ["name", "offer", "ask"] as const) {
    assert.ok(validateProfile({ ...defaultProfile, [field]: "   " }));
  }
});

test("profile text accepts exact limits and rejects longer values", () => {
  const limits = { name: 60, offer: 180, ask: 180 } as const;
  for (const [field, limit] of Object.entries(limits)) {
    const atLimit: Profile = { ...defaultProfile, [field]: "a".repeat(limit) };
    const tooLong: Profile = {
      ...defaultProfile,
      [field]: "a".repeat(limit + 1),
    };
    assert.equal(validateProfile(atLimit), null, `${field} accepts its limit`);
    assert.ok(validateProfile(tooLong), `${field} rejects text over its limit`);
  }
});
