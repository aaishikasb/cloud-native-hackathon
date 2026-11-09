import { randomUUID } from "node:crypto";
import {
  filterPeople,
  people,
  type Person,
  type Profile,
  type Topic,
} from "../detour.ts";
import {
  ApiError,
  guestToken,
  newGuestToken,
  ownerHash,
  parseProfile,
  requireId,
} from "./http.ts";
import {
  elastic,
  ensureIndices,
  hasElasticsearch,
  INVITES_INDEX,
  PEOPLE_INDEX,
  VersionConflict,
  type ElasticDocument,
  type SearchResult,
} from "./elasticsearch.ts";

type PersonDocument = Profile & {
  ownerHash: string;
  topic: Topic;
  role: string;
  location: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicPerson = Person & { mode: Profile["mode"] };
export type InvitationDocument = {
  memberIds: string[];
  acceptedIds: string[];
  hostId: string;
  meetingSpot: string;
  mode: Profile["mode"];
  expiresAt: string;
  createdAt: string;
};
export type Invitation = {
  id: string;
  members: PublicPerson[];
  acceptedIds: string[];
  expiresAt: string;
  meetingSpot: string;
  mode: Profile["mode"];
  viewerId: string | null;
};

const topics: Topic[] = [
  "All people",
  "AI & ML",
  "Cloud native",
  "Design",
  "Open source",
];
const publicFields = [
  "name",
  "offer",
  "ask",
  "mode",
  "available",
  "topic",
  "role",
  "location",
];

export function publicPerson(id: string, person: PersonDocument): PublicPerson {
  return {
    id,
    name: person.name,
    role: person.role,
    initials: person.name
      .split(/\s+/)
      .map((part) => [...part][0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    color: "sage",
    topic: person.topic,
    offer: person.offer,
    ask: person.ask,
    location: person.location,
    available: person.available,
    mode: person.mode,
  };
}

function profileOf(person: PersonDocument): Profile {
  return {
    name: person.name,
    offer: person.offer,
    ask: person.ask,
    mode: person.mode,
    available: person.available,
  };
}

async function currentPerson(
  request: Request,
): Promise<ElasticDocument<PersonDocument> | null> {
  // shortcut: identity belongs to one browser; add attendee login when recovery or verified identity is needed.
  const token = guestToken(request);
  if (!token) return null;
  const result = await elastic<SearchResult<PersonDocument>>(
    `${PEOPLE_INDEX}/_search`,
    "POST",
    {
      size: 1,
      seq_no_primary_term: true,
      query: { term: { ownerHash: ownerHash(token) } },
    },
  );
  return result!.hits.hits[0] ?? null;
}

async function requirePerson(request: Request) {
  const me = await currentPerson(request);
  if (!me)
    throw new ApiError(
      401,
      "Publish your introduction in this browser before joining a detour.",
    );
  return me;
}

export async function getNetwork(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") || "").trim();
  const topic = params.get("topic") || "All people";
  const availableOnly = params.get("available") === "true";
  if (query.length > 180 || !topics.includes(topic as Topic))
    throw new ApiError(
      400,
      "Use a shorter search or choose a listed interest.",
    );
  if (!hasElasticsearch()) {
    return {
      mode: "preview" as const,
      people: filterPeople(people, query, topic as Topic, availableOnly),
      me: null,
    };
  }
  await ensureIndices();
  const filters: unknown[] = [];
  if (availableOnly) filters.push({ term: { available: true } });
  if (topic !== "All people") filters.push({ term: { topic } });
  const [result, me] = await Promise.all([
    elastic<SearchResult<PersonDocument>>(`${PEOPLE_INDEX}/_search`, "POST", {
      // shortcut: discovery returns the first 100 matches; add pagination for larger events.
      size: 100,
      _source: publicFields,
      query: {
        bool: {
          filter: filters,
          must: query
            ? [
                {
                  multi_match: {
                    query,
                    fields: ["name^2", "offer^2", "ask", "role", "topic"],
                    type: "best_fields",
                    operator: "and",
                  },
                },
              ]
            : [{ match_all: {} }],
        },
      },
    }),
    currentPerson(request),
  ]);
  return {
    mode: "connected" as const,
    people: result!.hits.hits
      .filter((hit) => hit._id !== me?._id)
      .map((hit) => publicPerson(hit._id, hit._source)),
    me: me ? { id: me._id, profile: profileOf(me._source) } : null,
  };
}

export async function publishProfile(request: Request, value: unknown) {
  const profile = parseProfile(value);
  await ensureIndices();
  const current = await currentPerson(request);
  const token = current ? guestToken(request)! : newGuestToken();
  const id = current?._id ?? randomUUID();
  const now = new Date().toISOString();
  const document: PersonDocument = {
    ...profile,
    ownerHash: ownerHash(token),
    role: "Conference attendee",
    topic: "All people",
    location:
      profile.mode === "Text first" ? "Text first" : "At the conference",
    createdAt: current?._source.createdAt ?? now,
    updatedAt: now,
  };
  const condition = current
    ? `&if_seq_no=${current._seq_no}&if_primary_term=${current._primary_term}`
    : "&op_type=create";
  try {
    await elastic(
      `${PEOPLE_INDEX}/_doc/${id}?refresh=wait_for${condition}`,
      "PUT",
      document,
    );
  } catch (error) {
    if (error instanceof VersionConflict)
      throw new ApiError(
        409,
        "Your introduction changed in another tab. Refresh before publishing again.",
      );
    throw error;
  }
  return { id, profile, token };
}

export async function withdrawProfile(request: Request) {
  await ensureIndices();
  const me = await requirePerson(request);
  try {
    await elastic(
      `${PEOPLE_INDEX}/_doc/${me._id}?refresh=wait_for&if_seq_no=${me._seq_no}&if_primary_term=${me._primary_term}`,
      "DELETE",
    );
  } catch (error) {
    if (error instanceof VersionConflict)
      throw new ApiError(
        409,
        "Your introduction changed in another tab. Refresh and try withdrawing it again.",
      );
    throw error;
  }
}

export function parseInvitation(value: unknown, selfId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Choose the people for this detour.");
  const input = value as Record<string, unknown>;
  const ids = input.memberIds;
  if (
    !Array.isArray(ids) ||
    ids.length < 2 ||
    ids.length > 3 ||
    ids.some(
      (id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{20,64}$/.test(id),
    ) ||
    new Set(ids).size !== ids.length ||
    !ids.includes(selfId)
  ) {
    throw new ApiError(
      400,
      "A detour needs you and one or two different published attendees.",
    );
  }
  const meetingSpot =
    input.meetingSpot === undefined ? "Coffee bar" : input.meetingSpot;
  if (
    typeof meetingSpot !== "string" ||
    !meetingSpot.trim() ||
    meetingSpot.trim().length > 120
  )
    throw new ApiError(
      400,
      "Choose a meeting spot using 120 characters or fewer.",
    );
  return { memberIds: ids as string[], meetingSpot: meetingSpot.trim() };
}

async function loadMembers(ids: string[]): Promise<Map<string, PublicPerson>> {
  const result = await elastic<{
    docs: (ElasticDocument<PersonDocument> & { error?: unknown })[];
  }>(`${PEOPLE_INDEX}/_mget?_source=${publicFields.join(",")}`, "POST", {
    ids,
  });
  if (result!.docs.some((doc) => doc.error))
    throw new ApiError(
      503,
      "The attendee network is temporarily unavailable. Try again shortly.",
    );
  return new Map(
    result!.docs
      .filter((doc) => doc.found)
      .map((doc) => [doc._id, publicPerson(doc._id, doc._source)]),
  );
}

function orderedMembers(ids: string[], available: Map<string, PublicPerson>) {
  if (ids.some((id) => !available.has(id)))
    throw new ApiError(
      410,
      "Someone has withdrawn their introduction. Create a new detour with available people.",
    );
  return ids.map((id) => available.get(id)!);
}

async function membersFor(ids: string[]): Promise<PublicPerson[]> {
  return orderedMembers(ids, await loadMembers(ids));
}

function assertAvailable(members: PublicPerson[], mode: Profile["mode"]) {
  if (members.some((member) => !member.available))
    throw new ApiError(
      409,
      "Someone is no longer available. Choose another person or try later.",
    );
  if (members.some((member) => member.mode !== mode))
    throw new ApiError(
      409,
      "Choose people with the same in-person or text-first preference.",
    );
}

export function assertOpen(invitation: InvitationDocument, now = Date.now()) {
  if (
    !Number.isFinite(Date.parse(invitation.expiresAt)) ||
    Date.parse(invitation.expiresAt) <= now
  )
    throw new ApiError(
      410,
      "This invitation has expired. Ask for a new invitation.",
    );
}

async function invitationView(
  id: string,
  document: InvitationDocument,
  viewerId: string | null,
  members?: Map<string, PublicPerson>,
): Promise<Invitation> {
  assertOpen(document);
  return {
    id,
    members: members
      ? orderedMembers(document.memberIds, members)
      : await membersFor(document.memberIds),
    acceptedIds: document.acceptedIds,
    expiresAt: document.expiresAt,
    meetingSpot: document.meetingSpot,
    mode: document.mode,
    viewerId,
  };
}

export async function createInvitation(
  request: Request,
  value: unknown,
): Promise<Invitation> {
  await ensureIndices();
  const me = await requirePerson(request);
  const { memberIds, meetingSpot } = parseInvitation(value, me._id);
  const members = await membersFor(memberIds);
  assertAvailable(members, me._source.mode);
  const id = randomUUID();
  const document: InvitationDocument = {
    memberIds,
    meetingSpot,
    acceptedIds: [me._id],
    hostId: me._id,
    mode: me._source.mode,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  await elastic(
    `${INVITES_INDEX}/_doc/${id}?op_type=create&refresh=wait_for`,
    "PUT",
    document,
  );
  return {
    id,
    members,
    acceptedIds: document.acceptedIds,
    expiresAt: document.expiresAt,
    meetingSpot,
    mode: document.mode,
    viewerId: me._id,
  };
}

async function loadInvitation(id: string) {
  requireId(id);
  const result = await elastic<ElasticDocument<InvitationDocument>>(
    `${INVITES_INDEX}/_doc/${id}`,
    "GET",
    undefined,
    true,
  );
  if (!result)
    throw new ApiError(
      404,
      "This invitation could not be found. Check the link with the person who shared it.",
    );
  return result;
}

export async function getInvitation(
  request: Request,
  id: string,
): Promise<Invitation> {
  await ensureIndices();
  const [invitation, me] = await Promise.all([
    loadInvitation(id),
    currentPerson(request),
  ]);
  return invitationView(id, invitation._source, me?._id ?? null);
}

export async function listInvitations(request: Request): Promise<Invitation[]> {
  await ensureIndices();
  const me = await requirePerson(request);
  const result = await elastic<SearchResult<InvitationDocument>>(
    `${INVITES_INDEX}/_search`,
    "POST",
    {
      size: 50,
      sort: [{ createdAt: "desc" }],
      query: {
        bool: {
          filter: [
            { term: { memberIds: me._id } },
            { range: { expiresAt: { gt: "now" } } },
          ],
        },
      },
    },
  );
  const active = result!.hits.hits.filter((hit) => {
    try {
      assertOpen(hit._source);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) return false;
      throw error;
    }
  });
  if (!active.length) return [];
  const memberIds = [
    ...new Set(active.flatMap((hit) => hit._source.memberIds)),
  ];
  const members = await loadMembers(memberIds);
  const invitations = await Promise.all(
    active.map(async (hit) => {
      try {
        return await invitationView(hit._id, hit._source, me._id, members);
      } catch (error) {
        if (error instanceof ApiError && error.status === 410) return null;
        throw error;
      }
    }),
  );
  return invitations.filter(
    (invitation): invitation is Invitation => invitation !== null,
  );
}

export async function acceptInvitation(
  request: Request,
  id: string,
): Promise<Invitation> {
  await ensureIndices();
  const me = await requirePerson(request);
  for (let attempt = 0; attempt < 4; attempt++) {
    const invitation = await loadInvitation(id);
    const document = invitation._source;
    assertOpen(document);
    if (!document.memberIds.includes(me._id))
      throw new ApiError(
        403,
        "This invitation is for another attendee. Open it in the browser where you published your introduction.",
      );
    const view = await invitationView(id, document, me._id);
    if (document.acceptedIds.includes(me._id)) return view;
    assertAvailable(view.members, document.mode);
    const acceptedIds = [...document.acceptedIds, me._id];
    try {
      await elastic(
        `${INVITES_INDEX}/_doc/${id}?if_seq_no=${invitation._seq_no}&if_primary_term=${invitation._primary_term}&refresh=wait_for`,
        "PUT",
        { ...document, acceptedIds },
      );
      return { ...view, acceptedIds };
    } catch (error) {
      if (!(error instanceof VersionConflict)) throw error;
    }
  }
  throw new ApiError(409, "This detour was just updated. Try accepting again.");
}

export async function networkReady() {
  if (!hasElasticsearch())
    throw new ApiError(503, "Elasticsearch is not configured.");
  await ensureIndices();
  await elastic(`${PEOPLE_INDEX}/_search`, "POST", {
    size: 0,
    query: { match_all: {} },
  });
  return { status: "ready" };
}
