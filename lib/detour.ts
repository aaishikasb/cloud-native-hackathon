export type Topic =
  "All people" | "AI & ML" | "Cloud native" | "Design" | "Open source";

export type Person = {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: "lilac" | "peach" | "sage" | "blue";
  topic: Topic;
  offer: string;
  ask: string;
  location: string;
  available: boolean;
};

export type Profile = {
  name: string;
  offer: string;
  ask: string;
  mode: "In person" | "Text first";
  available: boolean;
};

export const defaultProfile: Profile = {
  name: "Aaishika",
  offer: "On-device AI & model optimization",
  ask: "Getting my model onto Kubernetes",
  mode: "In person",
  available: true,
};

// Fictional attendees keep the UI demo independent of real conference data.
export const people: Person[] = [
  {
    id: "ben",
    name: "Ben Carter",
    role: "Platform engineer",
    initials: "BC",
    color: "lilac",
    topic: "Cloud native",
    offer: "Getting your first Kubernetes deployment running",
    ask: "Accessibility feedback on a developer dashboard",
    location: "Coffee bar",
    available: true,
  },
  {
    id: "cara",
    name: "Cara Nguyen",
    role: "Product designer",
    initials: "CN",
    color: "peach",
    topic: "Design",
    offer: "An accessibility check and a fresh pair of eyes",
    ask: "Making an on-device model faster",
    location: "The long table",
    available: true,
  },
  {
    id: "maya",
    name: "Maya Patel",
    role: "ML engineer",
    initials: "MP",
    color: "sage",
    topic: "AI & ML",
    offer: "Small language models that fit on your laptop",
    ask: "A second opinion on my inference benchmarks",
    location: "Window seats",
    available: true,
  },
  {
    id: "eli",
    name: "Eli Brooks",
    role: "Open-source maintainer",
    initials: "EB",
    color: "blue",
    topic: "Open source",
    offer: "Finding a first issue and getting a PR across the line",
    ask: "Someone to try our new contributor guide",
    location: "Community table",
    available: true,
  },
  {
    id: "jules",
    name: "Jules Moreno",
    role: "Site reliability engineer",
    initials: "JM",
    color: "peach",
    topic: "Cloud native",
    offer: "Making sense of OpenTelemetry traces",
    ask: "A clearer way to explain service health",
    location: "Workshop room",
    available: false,
  },
  {
    id: "sam",
    name: "Sam Okafor",
    role: "Design engineer",
    initials: "SO",
    color: "lilac",
    topic: "Design",
    offer: "Keyboard-friendly interfaces and React component reviews",
    ask: "Advice on shipping a useful open-source tool",
    location: "Coffee bar",
    available: true,
  },
];

export function filterPeople(
  attendees: readonly Person[],
  query: string,
  topic: Topic,
  availableOnly: boolean,
): Person[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return attendees.filter((person) => {
    if (topic !== "All people" && person.topic !== topic) return false;
    if (availableOnly && !person.available) return false;

    const searchableText = [
      person.name,
      person.role,
      person.offer,
      person.ask,
      person.topic,
    ]
      .join(" ")
      .toLocaleLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

export function validateProfile(profile: Profile): string | null {
  if (!profile.name.trim()) return "Add your name so people know who to meet.";
  if (profile.name.trim().length > 60)
    return "Keep your name to 60 characters or fewer.";
  if (!profile.offer.trim()) return "Add something you can help someone with.";
  if (profile.offer.trim().length > 180)
    return "Keep your offer to 180 characters or fewer.";
  if (!profile.ask.trim()) return "Add something you would like help with.";
  if (profile.ask.trim().length > 180)
    return "Keep your ask to 180 characters or fewer.";
  return null;
}
