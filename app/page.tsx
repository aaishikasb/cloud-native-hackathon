import DetourApp from "@/components/detour-app";
import { DEFAULT_EVENT_ID, getEventId } from "@/lib/events";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const params = await searchParams;
  const eventId =
    getEventId(typeof params.event === "string" ? params.event : undefined) ??
    DEFAULT_EVENT_ID;
  return <DetourApp key={eventId} initialEventId={eventId} />;
}
