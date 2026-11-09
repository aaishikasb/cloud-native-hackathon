import type { Person } from "./detour.ts";

const stopwords = new Set(
  "a an and are as at be can could for from get getting have help how i in into is it its me my need of on onto or our someone that the their thing things this to try want what with would you your first fresh making looking something".split(
    " ",
  ),
);

function topics(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+(?:\+\+|#)?/gu) ?? [];
  return new Set(
    words
      .filter((word) => word.length > 1 && !stopwords.has(word))
      .map((word) => {
        if (word === "k8s") return "kubernetes";
        if (word === "a11y") return "accessibility";
        if (word.length > 4 && word.endsWith("ies"))
          return `${word.slice(0, -3)}y`;
        // Keep technical terms such as Kubernetes, CSS, and analysis intact.
        if (
          word.length > 3 &&
          word.endsWith("s") &&
          !/(ss|us|is|es)$/.test(word)
        )
          return word.slice(0, -1);
        return word;
      }),
  );
}

export function helpTopics(offer: string, ask: string): string[] {
  const wanted = topics(ask);
  return [...topics(offer)].filter((topic) => wanted.has(topic)).sort();
}

export function findDetours(
  self: Person,
  attendees: readonly Person[],
): { circle: Person[] | null; pairs: Person[] } {
  if (!self.available) return { circle: null, pairs: [] };

  const unique = new Map<string, Person>();
  // shortcut: only 100 available candidates are considered; use indexed graph retrieval for larger events.
  for (const person of attendees) {
    if (person.available && person.id !== self.id && !unique.has(person.id))
      unique.set(person.id, person);
    if (unique.size === 100) break;
  }
  const candidates = [...unique.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const offers = new Map(
    [self, ...candidates].map((person) => [person.id, topics(person.offer)]),
  );
  const asks = new Map(
    [self, ...candidates].map((person) => [person.id, topics(person.ask)]),
  );
  const overlap = (giver: Person, receiver: Person) =>
    [...offers.get(giver.id)!].filter((topic) =>
      asks.get(receiver.id)!.has(topic),
    ).length;

  const rankedPairs = candidates
    .map((person) => ({
      person,
      give: overlap(self, person),
      receive: overlap(person, self),
    }))
    .filter(({ give, receive }) => give + receive > 0)
    .sort((a, b) => b.give + b.receive - (a.give + a.receive));

  let circle: Person[] | null = null;
  let best = 0;
  // Every edge must have evidence; a high score cannot make up for a missing link.
  for (const first of rankedPairs) {
    if (!first.give) continue;
    for (const second of rankedPairs) {
      if (first.person.id === second.person.id || !second.receive) continue;
      const middle = overlap(first.person, second.person);
      if (!middle) continue;
      const score = first.give + middle + second.receive;
      if (score > best) {
        circle = [self, first.person, second.person];
        best = score;
      }
    }
  }

  return { circle, pairs: rankedPairs.map(({ person }) => person) };
}
