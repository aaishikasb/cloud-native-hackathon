# Detour

Conference networking app. Next.js App Router, React, TypeScript, Tailwind CSS 4, and Phosphor Icons. Package manager: npm. Use Node 24, matching CI and the container.

## Commands

- `npm install`
- `npm run dev` — local preview at http://localhost:3000
- `npm run build` — production validation
- `npm run typecheck`
- `npm test` — Node built-in tests; requires Node 22.6+ for TypeScript stripping (Node 23.6+ recommended).

## Project conventions

- Semantic colors and font mappings live in `app/globals.css`. Use Tailwind's existing scales.
- Stack Sans Notch is for headings and callouts; Stack Sans Text is for body and controls. Fonts and OFL licenses are self-hosted in `public/fonts`.
- `lib/detour.ts` contains fictional sample attendees and pure search/profile-validation logic.
- `lib/matching.ts` finds directed three-person help circles and pair fallbacks from shared keywords. This is not AI inference.
- `components/detour-app.tsx` owns the client UI and native dialogs. `lib/browser-state.ts` validates browser-local persistence; an unsaved sample must never become a restored user draft.
- `lib/server` and `app/api` use Elasticsearch for published profiles, search, and invitations. With both Elasticsearch variables absent, discovery is an explicitly labeled fictional preview. Configuration errors must not fall back to fictional people.
- Drafts stay local until explicit publication. Guest ownership uses an HttpOnly browser cookie; invitations have fixed members, expire after 24 hours, and require each member's own acceptance. Preserve origin checks, concurrency guards, and public field projections.
- NFC is an HTTPS URL entry point, not authentication. The QR code encodes the invitation URL; a public or otherwise phone-reachable URL is needed for a phone demo.
- Keep credentials server-side in ignored `.env.local` or Kubernetes Secrets. Do not log profile content, invitation URLs, owner tokens, or credentials. Only explicit safe operation spans are exported by `lib/telemetry.ts`.
- Read `docs/integrations.md` for service setup, deployment, and evidence requirements. Configured code is not proof of a live provider integration. Radar team is `salty`, cluster ID `2QK7T2SmT3o`, namespace `team-salty`; verify the name still matches and scope every operation to that cluster.
- The root README was intentionally removed. Do not recreate or push a README without the user's explicit approval.
- Verify desktop/mobile rendering and keyboard/dialog behavior after UI edits. Keep regression tests for nontrivial matching or persistence changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
