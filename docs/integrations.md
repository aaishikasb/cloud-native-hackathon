# Connect Detour to the four tracks

Repository: [aaishikasb/cloud-native-hackathon](https://github.com/aaishikasb/cloud-native-hackathon). Radar team: **salty**, namespace **team-salty**, public origin **https://salty.cnh.radarhq.io**. Gitar has been connected to the repository; its first completed review still needs verification.

The code is prepared for real services. An account, environment variable, or configuration file alone is not evidence of a working integration. Complete the checks below before describing a track as connected.

| Track | Implemented here | Required external setup |
| --- | --- | --- |
| Elasticsearch | Published profiles, search, invitations, optimistic concurrency, readiness checks | Elasticsearch endpoint and scoped API key |
| Dash0 | OpenTelemetry operation spans with duration, status, and safe attributes | OTLP HTTP endpoint, ingest token, dataset, observed traces |
| Radar | Standalone container, health probes, salty Kubernetes resources, GitOps image publishing | Radar authentication, runtime secrets, public image, actual rollout |
| Gitar | Connected repository, project-specific review requirements, CI checks | Actual PR review and recorded results |

## Local configuration

Use Node 24 and npm. Copy `.env.example` to `.env.local` and fill it in locally. Keep credentials out of source control, browser variables, Docker build arguments, screenshots, and chat. Next.js loads `.env.local`; restart the server after changes.

| Variable | Value |
| --- | --- |
| `ELASTICSEARCH_URL` | Elasticsearch HTTPS endpoint, without a trailing slash; localhost HTTP is supported for development |
| `ELASTICSEARCH_API_KEY` | Encoded Elasticsearch API key, without the `ApiKey ` prefix |
| `APP_URL` | Canonical origin, such as `http://localhost:3000`; use the public HTTPS origin after deployment |
| `OTEL_SERVICE_NAME` | `detour` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Dash0 OTLP **HTTP** base endpoint, without `/v1/traces` or a trailing slash |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Bearer <ingest-token>,Dash0-Dataset=<dataset>` |

Leave both Elasticsearch settings empty to use the labeled fictional preview. Partial configuration, authentication failures, or an unavailable configured service return an error; the app does not silently substitute sample people. `/healthz` checks the process; `/readyz` requires working Elasticsearch and returns 503 when it is unconfigured.

```sh
npm ci
npm test
npm run build
npm run typecheck
npm run dev
```

## Elasticsearch

Create an Elasticsearch project or deployment in your Elastic account. Copy its Elasticsearch endpoint, not the Kibana URL. Create an application API key scoped to indices `detour-*`, with `read`, `write`, `create_index`, and `view_index_metadata`. No cluster privileges are required by this app. Elastic documents API-key creation for [hosted deployments](https://www.elastic.co/docs/deploy-manage/api-keys/elasticsearch-api-keys) and links the corresponding Serverless flow there.

The first configured network/readiness request creates `detour-people` and `detour-invites` with explicit mappings when absent. Fictional attendees are never seeded into those indices. Published profiles are shared; a browser-local draft is not publication. The guest session lasts seven days and invitations expire after 24 hours.

Verify readiness, publish an introduction, then use a second browser session to publish another introduction. Check that searches return the shared profiles, create an invitation, and accept it from the intended session. Refresh both browsers to verify persistence. Inspect the two indices in Elastic and retain a screenshot using consented demo data. The regression tests simulate Elasticsearch; a live service check is still required.

## Dash0

In your Dash0 organization, copy the OTLP HTTP endpoint and create an ingest token for the intended dataset. Set the `OTEL_` values above using [Dash0's documented endpoint and header format](https://www.dash0.com/hub/integrations/int_nodejs/overview). Detour registers its SDK through Next.js instrumentation, so do not add a second Node auto-instrumentation preload.

The SDK starts only for the Node runtime when the OTLP endpoint is present. It exports only spans explicitly created by `traceOperation`. Framework request spans and automatic fetch spans are excluded because invitation URLs can contain bearer tokens. Operations record fixed labels, counts, duration, and status; raw exceptions and request/profile bodies are omitted. Kubernetes resource attributes include namespace, pod name, and pod UID.

Publish/search/accept with the service configured. In Dash0, filter traces to `service.name = detour`; verify operation spans and latency, then inspect a span's attributes for accidental personal data. Save a trace link or screenshot. Use Agent0 to investigate actual observed behavior and retain its evidence. This implementation does **not** yet export browser RUM, application logs, or application metrics; do not claim those signals or an Agent0 investigation until verified.

Implementation references: [Next.js OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) and [the @vercel/otel API](https://github.com/vercel/otel/tree/main/packages/otel).

## Radar and the public phone demo

The team is registered as **salty**; provisioning status is available on [the team's status page](https://join.cnh.radarhq.io/status/salty). Accept the Radar invitation and connect Codex from **Agents** in [Radar Cloud](https://app.radarhq.io). Discover the cluster whose name is exactly `salty`, then pass its actual cluster ID on every MCP call and `team-salty` as the namespace. The platform routes `https://salty.cnh.radarhq.io` to Service `app` on port 80. This configuration follows the [official starter](https://github.com/skyhook-io/cnh-starter).

Detour's CI runs tests, build, and typecheck. A successful application push to `main` publishes `ghcr.io/aaishikasb/cloud-native-hackathon:<full-commit-sha>`, then commits that immutable image tag to `deploy/kustomization.yaml`. The workflow can also run manually on `main`. Documentation-only and generated image-tag commits do not trigger another image build. Ensure the GHCR package is public so the cluster can pull it.

1. Create a Kubernetes Secret named `detour-secrets` in `team-salty` through Radar's secret management. Add `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_HEADERS`. The deployment already sets the canonical `APP_URL`, service name, and protocol. Do not commit a Secret manifest. Readiness requires working Elasticsearch.
2. Push the reviewed implementation to `main` and wait for CI's image build **and** `deploy:` commit. `deploy/kustomization.yaml` initially says `pending-first-build`; do not enable GitOps until CI replaces it with the successfully built commit's SHA. Pull the generated commit before later pushes.
3. Apply `argocd/application.yaml` once through Radar, targeting the discovered `salty` cluster. Application `app` lives in `team-salty`, uses project `team-salty`, and tracks this repository's `main` branch and `deploy` folder. After this step, future successful image-tag commits trigger automatic synchronization. Make application changes in git; do not patch Argo CD-owned Deployment/Service resources directly.
4. Observe the Deployment rollout and Service endpoints. Verify the workload image matches the built SHA, and the public `/healthz` and `/readyz` both return 200. Then publish and accept using two browsers.
5. Inspect Radar Checks before and after the rollout and run a genuine AI investigation. A release investigation that finds the app healthy is useful evidence; do not manufacture an outage. Save the timeline and investigation link for the submission.

The manifests preserve the starter's Deployment/Service name, container name, and immutable `app: app` selector. The HTTPRoute is retained for starter compatibility; the public gateway is managed by the hackathon platform. No application resource or Argo CD Application has been applied by preparing these files. Do not change the platform's preinstalled controllers or another team's cluster.

The container listens on `0.0.0.0:8080` as a non-root user. It needs runtime secrets, not build-time secrets. With Docker installed, a local smoke check is:

```sh
docker build -t detour:local .
docker run --rm --env-file .env.local -p 8080:8080 detour:local
```

For this local container check, set `APP_URL=http://localhost:8080` and use plain values without surrounding quotes in the Docker env file. `.env.local` is excluded from the image build context.

After the public flow works, write the actual invitation's HTTPS URL to the NFC card; its QR code should encode that same URL. The card opens an invitation and does not authenticate a participant. An invitation's 24-hour expiry means the demo card may need a fresh URL.

## Gitar

Gitar is connected to **aaishikasb/cloud-native-hackathon**. Confirm that repository appears in [Gitar](https://app.gitar.ai), then request its first review on the implementation PR. The [official quickstart](https://docs.gitar.ai/quickstart) explains reviewing a new or existing PR.

`.gitar/review/detour.md` asks Gitar to check profile validation, consent, guest authorization, invitation expiry, concurrent acceptance, secret handling, and telemetry privacy. Gitar loads this directory as [custom review instructions](https://docs.gitar.ai/configuration/repository-config). This file does not install the app or prove a review has run.

Open an implementation PR, let CI and Gitar finish, then inspect the findings and resolve any legitimate issue with a focused change. Save the PR link, Gitar review, relevant fix, and passing checks. Automatic merge and broad auto-apply permissions are not enabled by this repository.

## Submission evidence still to collect

- A real Elasticsearch query and cross-browser published profiles/invitations.
- A Dash0 trace and an Agent0 investigation of observed telemetry.
- A public Radar deployment, rollout/Checks timeline, and an AI investigation.
- A Gitar-reviewed PR with passing CI and any resulting fix.
- A phone + NFC/QR demonstration against the public URL.

Local regression tests and source review cover behavior, not cloud access. Account provisioning, live exports, container execution, image publication, cluster rollout, and Gitar activity require separate observed verification. Matching currently uses explicit profile signals; on-device AI must be implemented and measured before it is claimed.
