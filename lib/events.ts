export const events = [
  {
    id: "cloud-native-hackathon",
    name: "Cloud Native Hackathon",
    locations: ["Coffee bar", "Registration desk", "Quiet corner"],
  },
  {
    id: "kubecon-na-2026",
    name: "KubeCon NA 2026",
    locations: ["Coffee bar", "Registration desk", "Quiet corner"],
  },
] as const;

export type EventId = (typeof events)[number]["id"];
export const DEFAULT_EVENT_ID: EventId = "cloud-native-hackathon";
export const locationsNote =
  "Demo meeting suggestions. Confirm the location at your venue.";

export function getEventId(value?: string | null): EventId | null {
  if (value === null || value === undefined) return DEFAULT_EVENT_ID;
  return events.find((event) => event.id === value)?.id ?? null;
}
