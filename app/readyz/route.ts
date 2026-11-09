import { respond } from "../../lib/server/http.ts";
import { networkReady } from "../../lib/server/network.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => Response.json(await networkReady()));
}
