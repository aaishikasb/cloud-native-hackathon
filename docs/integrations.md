# Connect Detour to the four tracks

Repository: [aaishikasb/cloud-native-hackathon](https://github.com/aaishikasb/cloud-native-hackathon). Radar team: **salty**, namespace **team-salty**, public origin **https://salty.cnh.radarhq.io**.

An account, environment variable, or configuration file alone is not evidence of a working integration. The observations below distinguish verified connections from the remaining physical demo and recording steps.

| Track | Implemented here | Verified state |
| --- | --- | --- |
| Elasticsearch | Published profiles, search, invitations, optimistic concurrency, readiness checks | Live local and public API checks passed; physical phone demo remains |
| Dash0 | OpenTelemetry operation spans with duration, status, and safe attributes | Deployed pod spans observed; Agent0 investigation completed |
| Radar | Standalone container, health probes, salty Kubernetes resources, GitOps image publishing | Public deployment Synced and Healthy; AI investigation and follow-up completed |
| Gitar | Connected repository, project-specific review requirements, CI checks | Review and consent rule verified on PR #1 |

## Verified evidence — 2026-11-09

- **Elasticsearch:** the live Serverless project reports version 9.7.0. Aliases `detour-people` and `detour-invites` point to `detour-people-v1` and `detour-invites-v1`, with strict mappings matching the application and each alias marked as the write index. A live API smoke check passed 27 assertions covering publishing, search, separate guest sessions, invitation authorization, acceptance, persistence, and withdrawal. The public deployment then passed 28 assertions, including Secure/HttpOnly/SameSite cookies, at 21:59:25–22:00:07 UTC. Temporary test profiles and invitations were removed afterward; both indices contained zero documents.
- **Dash0:** the local application exports to the configured OTLP HTTP endpoint. The `detour` token permits ingestion of spans into the Default dataset. Both a safe synthetic SDK span and an actual Next.js network operation received HTTP 200 from the ingestion endpoint; operation spans were also observed in the Dash0 UI. The deployed pod `app-5b5c4879c4-m6mtl` was observed with `service.name=detour` and `k8s.namespace.name=team-salty`. [Agent0 investigated the onboarding traces](https://app.dash0.com/agent0?org=a0a1fe9b-9630-4232-bc0a-c3b0544bfc37&s=eJx1j8EOgjAQRP9lzxAQawLcDF48adAfWOgWmmBLoE00hH-3iEI08bSbmdmXnQECSAcQurQ98au8UY6qIkiVbRrvox9sh0Zq9eVJZahyOvF9RcqE__SL5FRgN9ujBwG-4wOsm6k7Qn7kkEIkIs52ycZnISt8FovER8bRL8KIIW1LpDIGx5mPcyrdyGo0_cSR_aklBanApqcltLzwE_DAPFpXCJRWtDIz7SrcJ-Dc6KWeOy1kM4XRGg3j-ATuEWvj). It reported 123 spans across nine operations and eight errors, with no recorded Elasticsearch transport failures. It identified repeated index checks and writes as latency contributors, and found no profile bodies, cookies, full API keys, or invitation URLs in the inspected attributes. Rejection reasons remain inferred because safe operation spans intentionally omit HTTP request details. These timings include local smoke tests and are not a production benchmark.
- **Release and Radar:** [PR #1](https://github.com/aaishikasb/cloud-native-hackathon/pull/1) merged as `c7923f874b5f92d96f8c698aae687a7457a601be`. [CI run 42697999349](https://github.com/aaishikasb/cloud-native-hackathon/actions/runs/42697999349) passed verification and published the image with that tag. An anonymous GHCR manifest request returned HTTP 200, confirming public pull access. Runtime Secret `detour-secrets` was created in `team-salty` on cluster `2QK7T2SmT3o`; Argo CD Application `team-salty/app` is **Synced and Healthy**, tracking revision `61d69357527c644950f0194150e6d99cda4bbf42`; Deployment `app` has 1/1 ready, updated, available replicas using that image. Sync completed at 21:58:13 UTC and health became Healthy at 21:58:20 UTC. Public `/healthz`, `/readyz`, and `/api/network` return HTTP 200, with the network in connected mode. Scoped diagnostics found no live issues.
- **Radar AI:** [investigation `chat_eHPZnUUl1jNlv9yt`](https://app.radarhq.io/c/2QK7T2SmT3o/investigations/chat_eHPZnUUl1jNlv9yt?org=org_NCJbssDGEBsU) and its release-verification follow-up completed. Radar confirmed 1/1 ready, updated, and available replicas; Argo Synced and Healthy; the expected image tag and Git revision; and a ready pod with zero restarts. It found no rollout failure, sync drift, or pending Argo operation. A writable container filesystem and a single replica remain hardening and availability limitations, not runtime failures; no remediation was applied. Before follow-up instructions could be supplied, Radar's automatic initial analysis queried broader cluster issues and namespace posture findings. The completed follow-up checked only the specified app resources. Public endpoint results were verified separately by the live API checks above.
- **Rendered UI:** the public connected empty state and introduction dialog were inspected on desktop and at 390×844. The circular-connection update was then inspected locally at 1280, 390, and 320 CSS pixels: three directed paths close the loop; full help relationships remain readable; connected, loading, fictional-match, filtered-empty, and saved-circle views retain their labels. At 320px the page has no horizontal overflow and the search field renders at 16px. The mobile dialog keeps labels, connection choices, consent copy, and its action visible; keyboard checks covered initial focus, Tab into the name field, Escape, and focus restoration. The new graphic is static. Six requested design skills were reviewed through parallel agents, and identified touch-target, copy, and dialog-containment issues were corrected. Physical phone/NFC use, actual 200% browser zoom, RTL, and cross-browser rendering remain unverified.
- **Gitar:** its review of PR #1 found repeated invitation-member lookups and unintended persistence of the sample introduction; both were fixed. Verification reported the attendee-consent repository rule passing, **1/1 met**. CI's 26 regression tests, build, and typecheck passed.

### Circular UI release evidence

[PR #2](https://github.com/aaishikasb/cloud-native-hackathon/pull/2) merged as `92f0a3c5ba342b9301a6f68b59fbe2befebbdf6b` after Gitar approved it with no issues and the attendee-consent rule passed (1/1). [CI run 42711532832](https://github.com/aaishikasb/cloud-native-hackathon/actions/runs/42711532832) passed tests, build, and typecheck on Node 24, then published that image. At 22:26:06 UTC, Argo was Synced and Healthy at generated revision `f1b98bed4efb78d95a0d4a9b9772977d7bb9aba6`, with Deployment `app` 1/1 ready, updated, and available. Pod `app-59d6b7fbbf-qwbk9` used the expected image and was Ready with zero restarts. Public desktop and 320px checks confirmed the new circle, three directed paths, no horizontal overflow, and a 16px mobile search field. `/healthz`, `/readyz`, and `/api/network` returned 200, with readiness `ready` and network mode `connected`.

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

The configured project uses the versioned indices and write aliases recorded above, so a later mapping migration can retain the app's index names. On an unprepared project, the first configured network/readiness request creates `detour-people` and `detour-invites` with explicit mappings when absent. Fictional attendees are never seeded into those indices. Published profiles are shared; a browser-local draft is not publication. The guest session lasts seven days and invitations expire after 24 hours.

For the public demo, verify readiness, publish an introduction, then use a second browser session to publish another introduction. Check that searches return the shared profiles, create an invitation, and accept it from the intended session. Refresh both browsers to verify persistence. Inspect the two indices in Elastic and retain a screenshot using consented demo data. The regression tests simulate Elasticsearch; the separate live API check is recorded above.

## Dash0

In your Dash0 organization, copy the OTLP HTTP endpoint and create an ingest token for the intended dataset. Set the `OTEL_` values above using [Dash0's documented endpoint and header format](https://www.dash0.com/hub/integrations/int_nodejs/overview). Detour registers its SDK through Next.js instrumentation, so do not add a second Node auto-instrumentation preload.

The SDK starts only for the Node runtime when the OTLP endpoint is present. It exports only spans explicitly created by `traceOperation`. Framework request spans and automatic fetch spans are excluded because invitation URLs can contain bearer tokens. Operations record fixed labels, counts, duration, and status; raw exceptions and request/profile bodies are omitted. Kubernetes resource attributes include namespace, pod name, and pod UID.

Publish/search/accept with the service configured. In Dash0, filter traces to `service.name = detour`; verify operation spans and latency, then inspect a span's attributes for accidental personal data. Save a trace link or screenshot. Use Agent0 to investigate actual observed behavior and retain its evidence. This implementation does **not** yet export browser RUM, application logs, or application metrics; do not claim those signals or an Agent0 investigation until verified.

Implementation references: [Next.js OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) and [the @vercel/otel API](https://github.com/vercel/otel/tree/main/packages/otel).

## Radar and the public phone demo

The team is registered as **salty**; provisioning status is available on [the team's status page](https://join.cnh.radarhq.io/status/salty). Codex is authenticated to Radar Cloud. Cluster `2QK7T2SmT3o` was verified as `salty`; confirm the name still matches and pass that cluster ID on every MCP call, with `team-salty` as the namespace. To reconnect, use **Agents** in [Radar Cloud](https://app.radarhq.io). The platform routes `https://salty.cnh.radarhq.io` to Service `app` on port 80. This configuration follows the [official starter](https://github.com/skyhook-io/cnh-starter).

Detour's CI runs tests, build, and typecheck. A successful application push to `main` publishes `ghcr.io/aaishikasb/cloud-native-hackathon:<full-commit-sha>`, then commits that immutable image tag to `deploy/kustomization.yaml`. The workflow can also run manually on `main`. Documentation-only and generated image-tag commits do not trigger another image build. Ensure the GHCR package is public so the cluster can pull it.

1. Ensure a Kubernetes Secret named `detour-secrets` exists in `team-salty` through Radar's secret management. It contains `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_EXPORTER_OTLP_HEADERS`. The deployment already sets the canonical `APP_URL`, service name, and protocol. Do not commit a Secret manifest. Readiness requires working Elasticsearch.
2. For each reviewed release on `main`, wait for CI's image build **and** `deploy:` commit. The first build has replaced `pending-first-build` in `deploy/kustomization.yaml` with the successfully built commit's SHA. Pull generated commits before later pushes.
3. Apply `argocd/application.yaml` once through Radar, targeting the discovered `salty` cluster. Application `app` lives in `team-salty`, uses project `team-salty`, and tracks this repository's `main` branch and `deploy` folder. After this step, future successful image-tag commits trigger automatic synchronization. Make application changes in git; do not patch Argo CD-owned Deployment/Service resources directly.
4. Observe the Deployment rollout and Service endpoints. Verify the workload image matches the built SHA, and the public `/healthz` and `/readyz` both return 200. Then publish and accept using two browsers.
5. Inspect Radar Checks before and after the rollout and run a genuine AI investigation. A release investigation that finds the app healthy is useful evidence; do not manufacture an outage. Save the timeline and investigation link for the submission.

The manifests preserve the starter's Deployment/Service name, container name, and immutable `app: app` selector. The HTTPRoute is retained for starter compatibility; the public gateway is managed by the hackathon platform. Prepared manifests alone do not establish a successful rollout; verify the live workload and public readiness. Do not change the platform's preinstalled controllers or another team's cluster.

The container listens on `0.0.0.0:8080` as a non-root user. It needs runtime secrets, not build-time secrets. With Docker installed, a local smoke check is:

```sh
docker build -t detour:local .
docker run --rm --env-file .env.local -p 8080:8080 detour:local
```

For this local container check, set `APP_URL=http://localhost:8080` and use plain values without surrounding quotes in the Docker env file. `.env.local` is excluded from the image build context.

After the public flow works, write the actual invitation's HTTPS URL to the NFC card; its QR code should encode that same URL. The card opens an invitation and does not authenticate a participant. An invitation's 24-hour expiry means the demo card may need a fresh URL.

## Gitar

Gitar is connected to **aaishikasb/cloud-native-hackathon**, and its review and consent rule were verified on [PR #1](https://github.com/aaishikasb/cloud-native-hackathon/pull/1). The [official quickstart](https://docs.gitar.ai/quickstart) explains requesting reviews for subsequent PRs.

`.gitar/review/detour.md` asks Gitar to check profile validation, consent, guest authorization, invitation expiry, concurrent acceptance, secret handling, and telemetry privacy. Gitar loads this directory as [custom review instructions](https://docs.gitar.ai/configuration/repository-config). This file does not install the app or prove a review has run.

`.gitar/rules/attendee-consent.md` is a separate `type: check` repository rule for affected backend, UI, persistence, and telemetry changes. It verifies explicit publication, server-owned participant identity, and private credentials, reporting code/test evidence in Verification without applying changes. [Gitar's rule format](https://docs.gitar.ai/features/rules) supports the `title`, `description`, `type`, `when`, and `actions` frontmatter used here. A PR touching none of those paths may correctly skip the rule; `gitar display:verbose` shows evaluated rules and skip reasons. Custom review instructions alone do not populate this rules result.

For subsequent implementation PRs, let CI and Gitar finish, then inspect the findings and resolve any legitimate issue with a focused change. Save the PR link, Gitar review, relevant fix, and passing checks. Automatic merge and broad auto-apply permissions are not enabled by this repository.

[Deployed Elasticsearch span in Dash0](https://app.dash0.com/traces/explorer?org=a0a1fe9b-9630-4232-bc0a-c3b0544bfc37&s=eJx1UMtuwjAQ_Jc9JwpcI3GIAFUUpAr6ED069iasauzgR1wpyr_XpgGJA8edmZ2Z3QEKKAdoNPcWxQed8cBUi1AqL2V2w1feMEdaPXCkHLYRR1G1qNzsGf5OAmtm_ukxg8IZxtGmWNsxtSPrllo11CaEcUc9fhGGjYASBLOnWd7HMU9amwtsmJcOog8lwemwdGo-_-5CWEAGV-vr5m5t7Poo9i5sj_vXF3FpVtWlWiSR7lDdyibXjZgqvvVogiF3P3Gye0bXjP98GnlXszoGG7TaG46p4nRqgb-d1AbjDwZAief4li2pVDPlwzj-ARiliiU%3D) (span `8510ad9f5d58a70c`, namespace `team-salty`).

## Submission evidence still to collect

- Public cross-browser published profiles/invitations, with consented demo screenshots.
- A screen recording of the verified Dash0 spans and Agent0 findings; the evidence links require organization access.
- A screen recording of the verified Radar rollout and completed AI investigation; the evidence link requires organization access.
- A phone + NFC/QR demonstration against the public URL.

Local regression tests and source review cover behavior, not cloud access; the verified service observations are recorded above. Matching currently uses explicit profile signals; on-device AI must be implemented and measured before it is claimed.
