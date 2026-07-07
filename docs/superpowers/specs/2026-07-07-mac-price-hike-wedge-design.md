# Mac Price-Hike Wedge + Worker Download — Design

**Date:** 2026-07-07
**Status:** Approved for planning

## Problem

On **June 25, 2026** Apple raised US list prices across the Mac/iPad lineup
(up to +$300/model; Mac Studio M3 Ultra $3,999 → $5,299), citing a global
DRAM/memory-chip shortage driven by AI data-center demand ("we have never seen
a component price increase this much, this quickly"; DRAM +~98% in Q1 2026).
News verified across CNN, Bloomberg, CNBC, MacRumors, 9to5Mac. There is **no
apple.com press release** — Apple only issues written statements to media — so
we link to 9to5Mac's "Apple confirms" coverage rather than a fabricated
apple.com URL.

This price surge is a marketing wedge for the Claw marketplace, which serves
**both** sides:

- **Consumers** who want to run ambient AI agents but can't justify buying a
  now-expensive Mac → rent Apple Silicon by the hour for cents.
- **Suppliers** whose Macs are now worth more → monetize idle time by running
  the `claw-worker` server binary and earning USDC.

The homepage should surface this timely hook and drive both CTAs, and the
"download worker" path must actually work end-to-end on a local dev machine so
we can dogfood it.

## Decisions (locked)

1. **Angle:** dual — price hike as the wedge, both audiences.
2. **Placement:** slim dated announcement banner above the header + retuned Hero
   copy/CTAs. Hero H1 and console visual stay.
3. **Download CTA:** a functional `/download` page **and** backend routes that
   serve `install.sh` + the worker tarball, testable against `localhost:8000`.
4. **Banner stat:** concrete Mac price jump.
5. **Source link:** 9to5Mac.

## Scope

### 1. Announcement banner — `web/src/components/marketing/AnnouncementBar.tsx` (new)

- Slim strip rendered at the very top of the homepage (`web/src/app/page.tsx`),
  above `<SiteHeader />`. Homepage-only for now (not global layout).
- Copy:
  > `JUN 25 2026 · Apple hiked Mac prices up to $300 (Mac Studio $3,999→$5,299) — rent capacity, don't buy` `[why?]`
- `[why?]` → `https://9to5mac.com/2026/06/17/apple-confirms-price-increases-are-coming-to-its-products-due-to-ram-shortage/`
  (opens in new tab, `rel="noopener noreferrer"`).
- Styling: mono, uppercase tracking, crimson accent — matches the existing beta
  pill / `SupplierCTA` idiom. Full-bleed, one line on desktop, wraps gracefully
  on mobile.
- **Dismissible:** client component; an `×` sets `localStorage["claw.pricehike.dismissed"]="1"`
  and hides. On mount, hidden if that key is set. Guard `localStorage` access for
  SSR (render server-side, hide client-side after hydration to avoid flash — use
  a mounted flag).

### 2. Hero retune — `web/src/components/marketing/Hero.tsx` (modify)

- Keep H1 (`Idle Apple Silicon, hired by the hour.`) and the `Console` visual.
- Replace the subhead paragraph with dual framing, e.g.:
  > "Macs just got expensive. Run sandboxed AI agents on rented Apple Silicon for
  > cents an hour — or host your own Mac and earn USDC. Every booking settles
  > on-chain for the hours actually used."
- CTAs: keep `[ Browse machines ]` (→ `/browse`); change the second button from
  "List your Mac" to **`Download worker ↓`** (→ `/download`). (The "List your
  Mac" onboarding link still lives in `SupplierCTA` lower on the page, so we
  don't lose that path.)

### 3. Download page — `web/src/app/download/page.tsx` (new)

Client component (needs `navigator` for OS/arch detection). Sections:

- **Compatibility check:** detect macOS + Apple Silicon via
  `navigator.userAgent` / `navigator.platform` (best-effort; `navigator.userAgentData`
  where available). Show "✓ Compatible — macOS / Apple Silicon" or a muted
  "claw-worker supports Apple Silicon Macs only" note. Detection is advisory,
  never blocks the download.
- **Install one-liner:** reuse `InstallSnippet` with
  `curl -fsSL ${apiBase}/install.sh | bash`, where
  `apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"` (mirrors
  `web/src/lib/api.ts`). Expose the base to the client via `NEXT_PUBLIC_API_URL`.
- **Direct download button:** anchor to
  `${apiBase}/releases/claw-worker-latest-aarch64-apple-darwin.tar.gz`
  (`download` attribute). Plain navigation — no fetch, no CORS.
- **Next steps:** register with a provisioning token from the supplier dashboard,
  then `run` — mirroring the messaging already in `worker/install.sh`. Link to
  `/auth/login?next=/dashboard/become-supplier` to get a token.
- Wrapped in `SiteHeader` / `SiteFooter` for consistency.

### 4. Backend distribution routes — `backend/src/claw_api/api/distribution.py` (new)

Mounted at the **app root** (not under the `/v1` prefix) because `install.sh`
expects `${API_URL}/install.sh` and `${API_URL}/releases/...`.

- `GET /install.sh` → returns the contents of `worker/install.sh` as
  `text/x-shellscript` (or `text/plain`). Read from disk at request time so edits
  to the script are picked up in dev.
- `GET /releases/{filename}` → serves a file from a release directory
  (`RELEASES_DIR`, default `worker/dist/`). Filename is validated against a strict
  allowlist pattern (`^claw-worker-[\w.\-]+-aarch64-apple-darwin\.tar\.gz$`) and
  resolved with no path traversal (reject `..`, `/`). 404 if missing. Use
  `FileResponse` with `application/gzip`.
- Wire into `create_app()` in `main.py`: `app.include_router(distribution.router)`.
- `RELEASES_DIR` read from `claw_api.config` (add a setting with a sensible
  default) so prod can point elsewhere.

### 5. Release packaging — `scripts/package-worker.sh` (new) + Makefile target

- Builds the worker (`cargo build --release` in `worker/`, or reuse the existing
  debug binary for a fast dev loop) and packages the `claw-worker` binary into
  `worker/dist/claw-worker-latest-aarch64-apple-darwin.tar.gz` (the name the
  install script + download button expect).
- Add a `Makefile` target (e.g. `make worker-dist`) that runs it.
- Document the local test loop in the README / STARTUP.md (see below).

## Local test loop (the "can I test on my machine" goal)

Machine is confirmed arm64 / Darwin with cargo 1.90 and a prebuilt
`worker/target/debug/claw-worker`.

1. `make worker-dist` → produces `worker/dist/claw-worker-latest-aarch64-apple-darwin.tar.gz`.
2. Run backend (`localhost:8000`) and frontend (`localhost:3000`).
3. Visit `/download`, or run
   `curl -fsSL http://localhost:8000/install.sh | CLAW_API_URL=http://localhost:8000 bash`.
4. `~/.claw/bin/claw-worker register --api-url http://localhost:8000 --provisioning-token <TOKEN>`
   then `... run --api-url http://localhost:8000`.

## Out of scope

- Production release signing/notarization (tracked separately in worker
  prerequisites).
- Global (non-homepage) announcement banner.
- Real code-signed / multi-arch release artifacts — dev serves the local build.
- Any change to booking/settlement flows.

## Testing

- **Backend:** unit tests for `distribution.py` — `/install.sh` returns 200 +
  script body; `/releases/<valid>` returns the tarball; traversal / bad filename
  → 404/400; missing file → 404.
- **Frontend:** `/download` renders; compatibility note reflects a mocked
  userAgent; install snippet + download href use the configured `apiBase`.
- **Banner:** renders with correct copy/link; dismiss hides it and persists via
  localStorage.
- **Manual:** the full local loop above.

## Risks / notes

- OS detection from `navigator` is heuristic — keep it advisory, never gate the
  download on it.
- Serving arbitrary files is a traversal risk → strict filename allowlist +
  resolved-path containment check, no user-supplied directory.
- `install.sh` currently defaults `API_URL` to `https://api.claw.dev`; local
  testing overrides via `CLAW_API_URL`. Leave the prod default intact.
