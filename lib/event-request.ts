import { events } from "./events.ts";

export type EventRequest = {
  slug: string;
  name: string;
  website: string;
  location: string;
  startDate: string;
  endDate: string;
  reason: string;
};

export type EventRequestDraft = Omit<EventRequest, "slug">;

export class EventRequestError extends Error {
  field: keyof EventRequest;
  constructor(field: keyof EventRequest, message: string) {
    super(message);
    this.field = field;
    this.name = "EventRequestError";
  }
}

export function eventRequestSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/g, "") || "event";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseEventRequest(value: unknown): EventRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new EventRequestError("name", "Add the event details before preparing a request.");
  const input = value as Record<string, unknown>;
  const limits = { slug: 64, name: 100, website: 300, location: 120, startDate: 10, endDate: 10, reason: 400 };
  const labels = { slug: "event identifier", name: "event name", website: "public website", location: "city or venue", startDate: "start date", endDate: "end date", reason: "reason" };
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(limits, key))
      throw new EventRequestError("reason", "Include only the requested public event details.");
  }
  const result = {} as EventRequest;
  for (const field of Object.keys(limits) as (keyof EventRequest)[]) {
    if (typeof input[field] !== "string" || !input[field].trim() || input[field].trim().length > limits[field])
      throw new EventRequestError(field, `Enter the ${labels[field]} (${limits[field]} characters or fewer).`);
    result[field] = input[field].trim();
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug) || result.slug !== eventRequestSlug(result.name))
    throw new EventRequestError("slug", "Use the event identifier generated from the event name.");
  let website: URL;
  try { website = new URL(result.website); }
  catch { throw new EventRequestError("website", "Use the event’s full public HTTPS website address."); }
  if (website.protocol !== "https:" || website.username || website.password || !website.hostname.includes(".") || website.hostname.endsWith(".local") || /^[\d.]+$/.test(website.hostname))
    throw new EventRequestError("website", "Use a public HTTPS website without embedded credentials or a local address.");
  for (const field of ["startDate", "endDate"] as const) {
    if (!validDate(result[field]))
      throw new EventRequestError(field, "Choose a valid date in YYYY-MM-DD format.");
  }
  if (result.endDate < result.startDate)
    throw new EventRequestError("endDate", "Choose an end date on or after the start date.");
  if (events.some((event) => event.id === result.slug || eventRequestSlug(event.name) === result.slug))
    throw new EventRequestError("name", "This event is already in Detour. Choose it from the event menu.");
  return result;
}

export function buildEventRequest(draft: EventRequestDraft): EventRequest {
  return parseEventRequest({ ...draft, slug: eventRequestSlug(draft.name) });
}

export function eventRequestFilename(request: EventRequest): string {
  const validated = parseEventRequest(request);
  return `event-requests/${validated.slug}-${validated.startDate}.json`;
}

export function eventRequestJson(request: EventRequest): string {
  return `${JSON.stringify(parseEventRequest(request), null, 2)}\n`;
}

export function eventRequestGitHubUrl(request: EventRequest): string {
  const url = new URL("https://github.com/aaishikasb/cloud-native-hackathon/new/main");
  url.searchParams.set("filename", eventRequestFilename(request));
  url.searchParams.set("value", eventRequestJson(request));
  return url.toString();
}
