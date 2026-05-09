# Worker Prerequisites — Production Hardening

This document lists every action that requires a human (account creation, ID verification, certificate issuance, manual review) before the worker binary can ship under its v2 threat model. v1 ("Trust-but-verify") skips all of these intentionally.

## 1. Apple Developer Program Enrollment
- Cost: $99 / year (organisation account)
- Lead time: 1–2 weeks for ID verification + D-U-N-S validation
- Owner: legal / founders
- Outcome: Team ID (10-char alphanumeric); used in entitlements + signing identity

## 2. Developer ID Application Certificate
- Source: developer.apple.com → Certificates → Developer ID Application
- Stored in: build-machine Keychain
- CI: store as base64 secret; install with `security import` at job start
- Expiry: 5 years; rotate ~6 months before expiry

## 3. Replace Ad-hoc Sign with Real Sign
- File: `worker/scripts/sign-adhoc.sh` becomes `sign-release.sh`
- Command:
  ```bash
  codesign --force --options runtime \
      --entitlements scripts/entitlements.plist \
      --sign "Developer ID Application: <ORG NAME> (<TEAM_ID>)" \
      target/aarch64-apple-darwin/release/claw-worker
  ```
- Add `scripts/entitlements.plist` (see d-inference's plist as reference; we don't need
  hypervisor entitlement for v2 unless we add Lima or Apple `container` host-side).

## 4. Notarization
- Tool: `xcrun notarytool submit <tarball> --apple-id <email> --team-id <TEAM_ID> --wait`
- Requires app-specific password from appleid.apple.com (NOT the main account password)
- After success: `xcrun stapler staple <tarball>`
- Without notarization: macOS Gatekeeper blocks downloaded binaries with "cannot verify developer"

## 5. CDN for Release Distribution
- v1 install.sh fetches from `$CLAW_API_URL/releases/...`
- v2: Cloudflare R2 or AWS S3+CloudFront with signed URLs; `install.sh` redirects to CDN
- Add SHA-256 manifest at `releases/manifest.json`; install.sh verifies hash before extract

## 6. Apple Business Manager (ABM) Account
- Required for: Managed Device Attestation (MDA)
- Lead time: 1–2 weeks; needs D-U-N-S + manual review
- Cost: free
- Outcome: ability to issue MDM enrollment profiles

## 7. MDM Server (or Vendor)
- Option A — operate yourself: open-source MicroMDM, Munki, Fleet, or Nano-MDM
- Option B — contracted: Jamf, Mosyle, Kandji
- Cost: $0–$5/device/month depending on vendor
- Plan-3-impact: enrollment profile delivered as part of supplier onboarding

## 8. ACME Server for Device Identity
- Used by Apple's MDA to issue device certificates
- Reference: `Layr-Labs/d-inference/scripts/enroll-with-acme.mobileconfig`
- Options: smallstep CA, Lego, or step-ca

## 9. Hardened Runtime Switchover
When all of the above are in place, three code changes:
1. `worker/scripts/entitlements.plist` — port from d-inference (drop hypervisor unless used)
2. `worker/build.rs` — add a release-only check that aborts unsigned builds
3. `worker/src/main.rs` — call `PT_DENY_ATTACH` at startup (`libc::ptrace(PT_DENY_ATTACH, 0, 0, 0)`)

## 10. Auto-Update Channel
- v1: user re-runs `install.sh`
- v2: `claw-worker update` subcommand that pulls signed manifest, verifies hash, swaps binary
- Use Sparkle-style EdDSA signature on manifest (separate key from Apple Developer ID)

## Decision Log
| Decision | Date | Reasoning |
|---|---|---|
| Defer all of the above to v2 | 2026-05-10 | No customers yet; collapse weeks of platform work into a single `codesign --sign -` |
| Pick Apple Developer ID over enterprise distribution | future | Enterprise dist requires per-customer MDM enrollment; we want public-internet supplier signup |
