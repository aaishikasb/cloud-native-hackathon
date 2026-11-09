---
title: "Protect attendee consent and identity"
description: "Verify that profile and invitation changes preserve explicit publication, server-owned identity, and private credentials."
type: check
when: "PRs modifying app/api/**, lib/server/**, components/detour-app.tsx, lib/browser-state.ts, lib/telemetry.ts, or instrumentation.ts"
actions: "Report whether the changed behavior preserves the invariants below, with code and test evidence in Verification. Do not modify files, apply fixes, or change repository settings."
---

Check the affected data flow from the browser through the route handler and storage or telemetry. Evaluate changed behavior; do not demand unrelated redesigns.

- Editing or restoring a local introduction must not publish it. Shared profile writes require the attendee's explicit publication action.
- Derive profile ownership and invitation acceptance identity from the server-validated guest cookie. Client-supplied IDs or owner hashes must not select someone else's identity. An NFC/QR invitation link may open the invitation, but only a listed participant authenticated in their own browser may accept it.
- Public API responses must omit guest tokens, owner hashes, API keys, and cookies. Explicitly published profile fields and shareable invitation IDs are intentional public output. Telemetry must omit profile text, full invitation URLs, credentials, and raw Elasticsearch error bodies.

Use `tests/server.test.ts`, `tests/browser-state.test.ts`, and `tests/telemetry.test.ts` as evidence where relevant. If a changed invariant lacks coverage, identify the specific missing assertion. Cite the actual code path and assertions; passing CI or a test's name alone does not prove the invariant.
