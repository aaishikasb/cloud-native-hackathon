import { ApiError } from "./http.ts";
import { traceOperation } from "../telemetry.ts";

export const PEOPLE_INDEX = "detour-people";
export const INVITES_INDEX = "detour-invites";

export function hasElasticsearch(): boolean {
  const url = process.env.ELASTICSEARCH_URL;
  const key = process.env.ELASTICSEARCH_API_KEY;
  if (!url && !key) return false;
  if (!url || !key)
    throw new ApiError(
      503,
      "The conference network is not fully configured yet.",
    );
  return true;
}

function connection() {
  if (!hasElasticsearch())
    throw new ApiError(
      503,
      "Publishing and invitations need a connected conference network.",
    );
  const url = new URL(process.env.ELASTICSEARCH_URL!);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  ) {
    throw new ApiError(
      503,
      "The conference network needs a secure Elasticsearch endpoint.",
    );
  }
  if (url.username || url.password || url.search || url.hash)
    throw new ApiError(
      503,
      "The conference network endpoint is not configured correctly.",
    );
  return {
    url: url.href.replace(/\/$/, ""),
    key: process.env.ELASTICSEARCH_API_KEY!,
  };
}

export class VersionConflict extends Error {}

export async function elastic<T>(
  path: string,
  method = "GET",
  body?: unknown,
  allowMissing = false,
): Promise<T | null> {
  const { url, key } = connection();
  return traceOperation(
    "elasticsearch.request",
    {
      "db.system.name": "elasticsearch",
      "db.operation.name": method,
      "db.collection.name": path.split("/")[0],
    },
    async () => {
      const response = await fetch(`${url}/${path}`, {
        method,
        headers: {
          Authorization: `ApiKey ${key}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 404 && allowMissing) return null;
      if (response.status === 409) throw new VersionConflict();
      if (!response.ok)
        throw new ApiError(
          503,
          "The conference network is unavailable. Please try again shortly.",
        );
      return method === "HEAD" ? ({} as T) : ((await response.json()) as T);
    },
  );
}

const mappings = {
  [PEOPLE_INDEX]: {
    dynamic: "strict",
    properties: {
      name: { type: "text" },
      offer: { type: "text" },
      ask: { type: "text" },
      mode: { type: "keyword" },
      available: { type: "boolean" },
      ownerHash: { type: "keyword" },
      topic: { type: "keyword" },
      role: { type: "text" },
      location: { type: "text" },
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
    },
  },
  [INVITES_INDEX]: {
    dynamic: "strict",
    properties: {
      memberIds: { type: "keyword" },
      acceptedIds: { type: "keyword" },
      hostId: { type: "keyword" },
      meetingSpot: { type: "text" },
      mode: { type: "keyword" },
      expiresAt: { type: "date" },
      createdAt: { type: "date" },
    },
  },
};

export async function ensureIndices() {
  // Recheck so externally removed indices can recover without restarting the app.
  await Promise.all(
    Object.entries(mappings).map(async ([index, mapping]) => {
      if (await elastic(index, "HEAD", undefined, true)) return;
      try {
        await elastic(index, "PUT", { mappings: mapping });
      } catch (error) {
        // Concurrent first requests may both try to create an index.
        if (!(await elastic(index, "HEAD", undefined, true))) throw error;
      }
    }),
  );
}

export type ElasticDocument<T> = {
  _id: string;
  _source: T;
  _seq_no: number;
  _primary_term: number;
  found?: boolean;
};
export type SearchResult<T> = { hits: { hits: ElasticDocument<T>[] } };
