import {
  readJson,
  requireSameOrigin,
  respond,
} from "../../../lib/server/http.ts";
import {
  createInvitation,
  listInvitations,
} from "../../../lib/server/network.ts";
import { traceOperation } from "../../../lib/telemetry.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return respond(() =>
    traceOperation("invitations.list", {}, async () =>
      Response.json({ invitations: await listInvitations(request) }),
    ),
  );
}
export async function POST(request: Request) {
  return respond(() =>
    traceOperation("invitation.create", {}, async () => {
      requireSameOrigin(request);
      return Response.json(
        await createInvitation(request, await readJson(request)),
        { status: 201 },
      );
    }),
  );
}
