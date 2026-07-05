# Darkbloom-Inspired Improvements for Claw Marketplace

Source: https://github.com/Layr-Labs/d-inference (Darkbloom — private inference on idle Macs).
Status: review draft. No code changed yet.

## TL;DR

Darkbloom's contribution to the world is **not** a Mac TEE — Apple Silicon has none. It's a **defense-in-depth recipe** that makes a Mac process *behave* like a TEE for a small set of properties (operator can't read prompts, can't swap the binary, can't MITM the wire). We can lift most of that recipe into claw-marketplace **without Apple paperwork** for Phase 1, and with one paid signing certificate for Phase 2. The "true TEE" parts (SEV-SNP for the backend, Apple MDA for the worker) are infra/admin decisions, not code.

---

## Side-by-side: what they have vs what we have

| Capability | Darkbloom | Claw today | Gap |
|---|---|---|---|
| Backend TEE | Go coordinator in **AMD SEV-SNP CVM** | FastAPI on plain Linux | **Deploy-time change**, no code |
| E2E sealing consumer→backend | Optional NaCl Box to coordinator X25519 key | TLS only | Small backend endpoint + client SDK doc |
| E2E sealing backend→worker | **Mandatory** per-request NaCl Box to worker's attested key | Plaintext JSON over WSS | Rust + Python crypto, ~1 day |
| Worker attestation key | Secure Enclave P-256, non-exportable, signs nonce | None (just a bearer worker_token) | Rust + `security-framework`, ~1 day |
| Anti-debugger | `PT_DENY_ATTACH` at startup | None | **5 lines of Rust FFI** |
| Hardened Runtime | Codesign `--options runtime`, notarized | Ad-hoc signed (`-`) | **Needs $99/yr Apple Developer ID** |
| In-process inference | MLX Swift linked into provider binary | We **shell out** to `mlx_lm.server` subprocess on `127.0.0.1:<port>` | Big refactor (or accept the seam + harden it) |
| Trust level header on responses | `X-Provider-Trust-Level: none/self_signed/hardware` | None | Backend response middleware, ~1 hr |
| Public attestation endpoint | `GET /v1/providers/attestation` | None | Backend route, ~2 hr |
| Challenge-response liveness | Coordinator re-verifies SIP/Secure Boot every 5 min | Just heartbeat with sysinfo | Worker `verify` RPC handler, ~½ day |
| MDM + Apple MDA chain | Yes (`hardware` trust level) | None | **Apple Business Manager + MDM vendor; ~weeks of paperwork + $** |
| APNs code-identity attestation | Yes | None | Requires team-signed binary first |
| Hypervisor.framework Stage-2 memory isolation | Yes | None | Rust + `Hypervisor.framework` FFI; complex but feasible |
| Self-route ("use my own Mac, free") | Yes | No | Routing flag in backend `bookings` create path |
| Direct/local mode (skip backend entirely) | Yes | No | Worker exposes OpenAI-compatible local server; consumer SDK flag |
| Model integrity (per-file SHA-256 vs catalog) | Yes, catalog DB + verified on download | We pull from HF, no hash pinning | Catalog table + verification in `inference/models.rs`, ~½ day |
| OpenAI/Anthropic-compatible surface | Yes | We expose bookings/messages — **not** OpenAI-shaped | Compat shim in FastAPI, ~1 day |

---

## Detailed improvement table (proposed order)

| # | Improvement | What we build | Files touched | Effort | Benefit | Cost / approval needed |
|---|---|---|---|---|---|---|
| 1 | `PT_DENY_ATTACH` at worker startup | Rust FFI call in `main.rs` Run handler | `worker/src/main.rs` | 1 hr | Operator can't `lldb` the running worker — blocks the easiest plaintext leak | **None** — pure code |
| 2 | Per-worker X25519 keypair, public key registered with backend | Generate at register-time, store private in Keychain (we already depend on `keyring`); add `pubkey` field to `POST /v1/workers/register` and Worker DB row | `worker/src/api/client.rs`, `worker/src/main.rs`, `backend/src/claw_api/api/v1/workers.py`, alembic migration | ½ day | Cryptographic identity per worker; precondition for everything below | **None** |
| 3 | Backend re-seals booking + chat payloads with NaCl Box | Replace plaintext `agent_config` / `content` in `WorkerEvent` with `{nonce, ciphertext, ephemeral_pubkey}`; worker decrypts before use | `backend/src/claw_api/realtime.py` + `api/v1/bookings.py` + `messages.py`, `worker/src/api/ws.rs`, `worker/src/booking/mod.rs` | 1 day | Supplier running the worker **cannot read consumer prompts** even with full root | **None** — `crypto_box` (Rust) + `pynacl` (Python) |
| 4 | Trust-level response headers on every API response | FastAPI middleware: `X-Provider-Trust-Level`, `-Encrypted`, `-Chip`, `-Secure-Enclave` derived from selected worker's posture | `backend/src/claw_api/middleware/trust.py` (new) | 2 hr | Consumers can programmatically gate on trust level | **None** |
| 5 | Public attestation endpoint | `GET /v1/workers/{id}/attestation` returns worker pubkey + last challenge result + chip/OS facts | `backend/src/claw_api/api/v1/workers.py` | 2 hr | Verifiability story for marketing + audit | **None** |
| 6 | Challenge-response liveness | Backend pushes random nonce over WS every 5 min; worker signs with Secure Enclave key; backend verifies; downgrades trust level on failure | `backend/src/claw_api/realtime.py`, `worker/src/api/ws.rs` | ½ day | Detects worker tampering / replaced binary mid-session | **None** |
| 7 | Self-route flag | `X-Claw-Route: self` header on booking create → backend filters worker pool to caller's owned suppliers; explicit error if none free | `backend/src/claw_api/api/v1/bookings.py` | 2 hr | "Use my own Mac for free" — strong DX hook | **None** |
| 8 | Model catalog with SHA-256 pinning | DB-backed `models` table; worker downloader verifies aggregate hash before serving; rejects mismatched files | `backend/src/claw_api/models/model.py` (new), alembic migration, `worker/src/inference/models.rs` | 1 day | Supplier can't ship a poisoned/finetuned model and have it still appear as `gemma-4-26b` | **None** |
| 9 | OpenAI-compatible chat-completions facade | `/v1/chat/completions` proxy that creates an ephemeral booking and streams SSE through it | `backend/src/claw_api/api/v1/openai_compat.py` (new) | 1 day | Any OpenAI SDK works against us with one URL change — same DX trick that made Darkbloom adoptable | **None** |
| 10 | Direct/local mode | `claw-worker serve --local` exposes OpenAI-compatible HTTP on the Mac itself; consumer points base_url at it | `worker/src/api/local.rs` (new) | ½ day | Offline / LAN / dev path; bytes never leave the network | **None** |
| 11 | Hardened Runtime + notarization | Switch from ad-hoc to Developer ID signing in release pipeline; add entitlements plist (no `get-task-allow`, no debugger, no library validation off); notarize via `notarytool` | `agent-image/`, build script, new `entitlements.plist` | ½ day code + 1 day Apple cycle | Blocks `task_for_pid`, dyld injection, debugger attach **at OS level** — unlocks `self_signed` trust tier | **$99/yr Apple Developer ID** + 1-2 days for Apple to issue the cert |
| 12 | Backend in SEV-SNP / TDX CVM | Deploy FastAPI to GCP `c3d-…confidential` or Azure DCa-v5; publish remote attestation report; expose `GET /v1/coordinator/attestation` | Terraform / deploy config; no app code change | ½ day infra | The plaintext window (during routing + billing) lives in hardware-encrypted RAM, never on disk; matches Darkbloom's strongest claim | **Cloud cost delta ~2x of equivalent regular VM**; no approval, no Apple involvement |
| 13 | Secure Enclave attestation key (`self_signed` tier) | Replace soft X25519 from #2 with SE-bound P-256 via `Security.framework`; key non-exportable, ACL = current binary only; sign challenge with it | `worker/src/attestation/` (new), Rust FFI | 1-2 days | Hardware-rooted identity — operator can't extract the key even with root | **None** (works on ad-hoc signed binaries; *much* stronger when paired with #11) |
| 14 | In-process inference (drop the subprocess seam) | Replace `mlx_lm.server` subprocess with `mlx-rs` bindings OR a Swift sidecar linked into a Swift wrapper binary | `worker/src/inference/` major refactor | **1-2 weeks** | Closes the "decrypted prompt sits in a child process the operator can ptrace" gap — the single biggest gap vs Darkbloom | **None** but high engineering cost |
| 15 | Hypervisor.framework Stage-2 page-table isolation | Wrap inference memory regions in `hv_vm_map` so DMA peers can't read them | `worker/src/inference/hv.rs` (new) | 1 week | Defends against PCIe / Thunderbolt DMA snooping — required if we ever take "physical custody" threats seriously | **None** code-wise; depth-of-defense; only meaningful after #14 |
| 16 | MDM + Apple Managed Device Attestation (`hardware` tier) | Enroll suppliers' Macs via an MDM (Kandji/Jamf/Mosyle); query SecurityInfo + MDA cert chain from coordinator | `backend/src/claw_api/attestation/mdm.py` (new) | 1 week code + paperwork | The strongest claim Darkbloom makes — Apple itself vouches the device is genuine, SIP on, Secure Boot on, FileVault on | **Apple Business Manager account ($0)** + **MDM vendor ($3-8/device/mo)** + **weeks of enterprise onboarding**; supplier UX hit (they must accept MDM profile) |
| 17 | APNs code-identity attestation | Send push to enrolled device, Apple returns signed proof of the running binary's CDHash | `backend/src/claw_api/attestation/apns.py` (new) | ½ day | Final layer — proves the binary that signed your attestation blob is the one the customer authorized | Requires #11, #16 first |

---

## Can we do Phase 1 + Phase 2 quickly?

**Phase 1 (#1, #2, #3, #4, #5, #7) — fully free, ~3 dev days total.**
Zero approvals. Zero new accounts. Pure Rust + Python work. Result: consumer prompts are end-to-end encrypted to the worker, backend has X25519 identities for every worker, debugger attachment is denied. Demo property: *"even with `lldb -p <worker_pid>` the operator sees encrypted blobs."*

**Phase 2 (#6, #8, #9, #10, #12, #13) — mostly free, ~5 dev days + ½ day infra.**
- Code-only: #6 (liveness), #8 (model pinning), #9 (OpenAI compat), #10 (local mode), #13 (SE key).
- Infra-only: #12 (CVM deploy). Needs a GCP/Azure CVM SKU enabled on the cloud account — usually a checkbox, no human approval. **Cost: backend bill roughly doubles**; no other money out the door.

So **Phase 1 + Phase 2 are doable in ~8 dev days with zero external approvals and only a marginal cloud bill increase.**

**Phase 3 (#11, #16, #17) — gated on Apple + money:**
- #11 (Hardened Runtime + notarization) needs **$99/yr Apple Developer Program** enrollment. ~1-2 day cycle for Apple to approve the team.
- #16 (MDM + MDA) needs **Apple Business Manager** (free, but takes a week or two to verify the org) + an **MDM vendor contract** ($3-8/device/month) + supplier-side UX for accepting the enrollment profile.
- #17 follows from those.

**Phase 4 (#14, #15) — high engineering effort, no Apple gates:**
- In-process MLX and Hypervisor.framework are pure code, but together they're 2-3 weeks of focused work. Worth doing **only after** Phase 1-3 close the easier holes, otherwise you've fortified the bedroom door while the front gate is open.

---

## Recommended order of attack

1. **This week:** #1, #2, #3, #4, #5, #7. Land as one PR — gives a credible "your prompt is end-to-end encrypted to the worker" claim.
2. **Next week:** #8, #9, #10. Land as one PR — unlocks adoption ("works with any OpenAI SDK") and self-host story.
3. **Right after:** #12 deploy migration + #13 SE key + #6 liveness. Land as ops change + small worker PR.
4. **Decide:** is Phase 3 worth $99/yr + MDM contract? If we want to advertise `hardware` trust level publicly to enterprise customers, yes. If we're targeting prosumers, #1-13 is already a stronger story than 99% of inference APIs.
5. **Park #14, #15** until a customer asks for them or until we hit the limit of what `self_signed` trust unlocks commercially.

---

## Open questions for you

1. Are we OK staying on the `mlx_lm.server` subprocess for now, or do we want to invest in in-process MLX (#14) up front? It's the single biggest deviation from Darkbloom's architecture.
2. Do you want the OpenAI-compatible facade (#9) on the **same** FastAPI app, or a separate service? Same app is faster; separate keeps the booking/marketplace surface clean.
3. Phase 3 (`hardware` trust): pursue now, or after we have paying customers asking?
