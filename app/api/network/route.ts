import { respond } from "../../../lib/server/http.ts";
import { getNetwork } from "../../../lib/server/network.ts";
import { traceOperation } from "../../../lib/telemetry.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return respond(() =>
    traceOperation("network.search", {}, async () =>
      Response.json(await getNetwork(request)),
    ),
  );
}
