# Claw Marketplace — Security Analysis & Threat Model

**Date:** 2026-05-10
**Status:** Decided — v1 ships under "Trust-but-verify"; cryptographic supplier-isolation deferred to v2.

---

## 1. Original Requirement

From `plan.md` and `tech-discussion.md`:

> "Sandbox, OpenClaw/Hermes and local models deployment all should run in Trusted Execution Environments (TEEs) to ensure security and privacy for both suppliers and consumers."
>
> "I want a design that gives the consumer confidence that the supplier cannot see what's happening inside the agent. If possible, we should support end-to-end encryption for chat interactions... A protocol similar to Noise (as used by Signal) would be ideal."
>
> "Refer how TEE was utilised to deploy this models in hardened process using vllm-mlx. I want to start the openclaw or hermes deployment the sameway in hardened process or enclave in macbook."

The reference implementation cited: **Darkbloom** (`darkbloom.dev`) / `Layr-Labs/d-inference`.

**Threat model implied by the spec:**

| Adversary | Capability | Must NOT be able to |
|-----------|-----------|---------------------|
| Supplier (machine owner) | Root, physical access | Read consumer prompts, agent state, model responses |
| Network observer | Passive + active MITM | Read chat traffic |
| Marketplace operator (us) | Backend access | Read consumer ↔ agent payloads (E2E goal) |
| Other consumers | API access | Cross-tenant data leakage |

The hardest one is **supplier-with-root**. That's what Darkbloom solves and what consumes most of this analysis.

---

## 2. What Darkbloom Actually Does (verified from source)

Investigated repo: `github.com/Layr-Labs/d-inference` (master branch, accessed 2026-05-10).

### 2.1 Architecture
```
Consumer → Coordinator (Go, Confidential VM) → Provider (Rust, hardened process) → vllm-mlx → Apple Silicon GPU
```

- Provider connects **outbound** over WebSocket (no port forwarding, no inbound exposure).
- Coordinator encrypts each request with the provider's X25519 public key. Only the hardened provider process can decrypt.

### 2.2 In-process inference (no IPC surface)
From `provider/Cargo.toml`:
```toml
pyo3 = { version = "0.24", features = ["auto-initialize"], optional = true }
# "Links the Python interpreter directly into our binary so inference
#  happens in our hardened process. No subprocess, no IPC, no sniffable channel."
```
The Python interpreter is **embedded** in the Rust binary so the model runs in the hardened process's address space. No subprocess, no local server, no IPC.

### 2.3 Hardened Runtime + SIP enforcement
From `scripts/sign-hardened.sh`:
```bash
codesign --force --options runtime \
    --entitlements "$ENTITLEMENTS" \
    --sign "$IDENTITY" "$PROVIDER_BIN"
```

From `scripts/entitlements.plist`:
```xml
<!-- NO get-task-allow → blocks debugger attachment under Hardened Runtime -->
<key>com.apple.security.hypervisor</key><true/>
<key>com.apple.security.network.client</key><true/>
<key>com.apple.security.network.server</key><true/>
<key>com.apple.security.keychain-access-groups</key>
<array><string>SLDQ2GJ6TL.io.darkbloom.provider</string></array>
```
- `--options runtime` enables Hardened Runtime.
- No `get-task-allow` → `task_for_pid()` fails for any external inspector → `lldb`/`dtrace` can't attach, `mach_vm_read()` from other processes denied by kernel.
- `PT_DENY_ATTACH` is called from process startup.
- Protections are immutable for process lifetime: disabling SIP requires reboot, which terminates the process.

### 2.4 Secure Enclave identity
From `enclave/Sources/EigenInferenceEnclave/SecureEnclaveIdentity.swift`:
- Hardware-bound P-256 ECDSA key via `SecureEnclave.P256.Signing.PrivateKey()` (CryptoKit).
- Private key never leaves the SE; only signing operations exposed.
- Used for attestation signing + periodic challenge-response from coordinator.

### 2.5 Four-layer attestation
From `enclave/Sources/EigenInferenceEnclave/Attestation.swift`:
1. **Secure Enclave signatures** — proves hardware identity.
2. **MDM-based independent verification** — device enrolled with Apple Business Manager.
3. **Apple Managed Device Attestation (MDA)** — Apple-signed cert chains via ACME.
4. **Periodic challenge-response** — coordinator re-verifies the same hardware is still present.

The repo includes `scripts/enroll-with-acme.mobileconfig` — the actual MDM enrollment profile. Their own comment:
> "In production, these would come from Managed Device Attestation (MDA), which provides hardware-attested evidence via Apple Business Manager. The software checks are development placeholders."

### 2.6 Build complexity
- Rust + Swift FFI: `provider/build.rs` invokes `swift build` on the Swift enclave package, links it as a static lib + Foundation/Security/CryptoKit frameworks.
- `provider/src/main.rs` is **286 KB** in one file. `coordinator.rs` 60 KB, `security.rs` 54 KB. Even after public release this is a heavy codebase.

---

## 3. Why Replicating This Is Hard

To match Darkbloom's guarantees, we'd need (none of which are pure code):

| Requirement | What it costs |
|---|---|
| Apple Developer Program membership | $99/yr, ID verification, manual approval |
| Developer ID Application certificate | Per-team, requires Apple account |
| Apple Business Manager account | Org enrollment, D-U-N-S number |
| MDM server | Custom build or contracted vendor (Jamf, Mosyle) |
| ACME server for cert issuance | Operate or integrate; binds to ABM |
| Confidential VM hosting (coordinator) | GCP CC, AWS Nitro, Azure CC |
| Notarization pipeline | `xcrun notarytool` per release, Apple ID + app-specific password |
| Swift toolchain on every build agent | CI complexity |
| Rust + Swift FFI build orchestration | Heavy |

This is roughly **3-6 person-months** of platform engineering just to reach Darkbloom's starting line — and the security guarantees come from infrastructure decisions, not from code an autonomous loop can produce.

---

## 4. Alternatives Considered

| Option | Threat model coverage | Cost | Verdict |
|---|---|---|---|
| **Replicate Darkbloom (Hardened Runtime + SE + MDM + MDA)** | Strongest on Mac; Apple PCC-equivalent | Very high (months) | Defer to v2/v3 |
| **Move state off supplier; supplier runs only inference** | Strong; supplier sees ciphertext + token counts | Medium | Strong v2 candidate |
| **App Sandbox / sandbox-exec / Virtualization.framework** | Does NOT block memory inspection by host | Low | Wrong tool |
| **Linux confidential VMs (SEV-SNP / TDX) on supplier hardware** | Strong; better tooling than macOS | Medium; loses Mac supplier story | Possible parallel track |
| **Threshold/MPC across multiple suppliers** | Strong; complex | Very high; research-grade | Out of scope |
| **Trust-but-verify** (signed binary + open source + audit logs + reputation + contracts) | Weak cryptographically; relies on operational + legal controls | Low | **v1 choice** |

### Why Trust-but-verify for v1
- We don't have suppliers or consumers yet. Cryptographic supplier-isolation has zero customer pull until there's at least one consumer with a regulatory/compliance need for it.
- Most working marketplaces ship trust-and-rep first and add cryptographic guarantees later (Vast.ai, RunPod, Salad — none had TEEs at launch).
- It collapses the worker-binary security work from "months of Apple/cloud account provisioning" to "single `codesign --options runtime` flag" — buildable by an autonomous loop.
- It lets us validate the marketplace economics (suppliers will install, consumers will pay) before investing in the hard parts.

---

## 5. Decision: v1 Threat Model & Controls

### What we explicitly DO NOT claim in v1
- Cryptographic guarantee that suppliers can't read agent state or prompts.
- End-to-end encrypted chat (Noise / Signal-style).
- Hardware-attested supplier identity.
- TEE for sandbox / model execution.

### What we DO claim in v1
- **Open source worker binary** — anyone can audit what it does.
- **Code-signed + Hardened Runtime** — minimal Apple Developer setup ($99/yr), prevents casual debugger attachment. Doesn't stop a determined supplier with root, but raises the bar.
- **TLS 1.3 everywhere** — supplier ↔ marketplace, consumer ↔ marketplace, consumer ↔ supplier (via marketplace-issued certs).
- **Transparent audit logs** — every supplier action (process start, resource access) logged to marketplace; consumers can review.
- **Reputation system** — supplier rankings based on uptime, complaints, dispute resolution.
- **Clear ToS** — suppliers contractually agree not to inspect consumer payloads. Violations = removal + civil liability.
- **Pseudonymous consumer identity** — consumers don't share PII with suppliers.

### Roadmap to stronger guarantees
- **v1.5 (post-PMF):** Move sensitive state off supplier — agent runs in our confidential VM, supplier only serves inference tokens.
- **v2:** Hardened Runtime + Secure Enclave attestation on Mac suppliers; Linux SEV-SNP track for server suppliers.
- **v3:** Full Darkbloom-equivalent with MDM/MDA attestation chain.

---

## 6. Open Questions (resolve before plan)

1. **Worker platform v1:** macOS only, Linux only, or both? (Affects build complexity significantly.)
2. **Sandbox tech v1:** Docker, Lima, native macOS process, or something else?
3. **Auth for marketplace API:** Magic-link, OAuth, password? Same for supplier and consumer?
4. **Inference path v1:** Does the worker actually run a model, or just register itself and report metrics? (MVP could ship without real inference.)
5. **OpenClaw/Hermes/local models — in v1 or deferred?**
6. **Payments — Stripe in v1 or v2?**

These get pinned in the planning step.

---

## 7. References

- Darkbloom: <https://www.darkbloom.dev/>
- d-inference repo: <https://github.com/Layr-Labs/d-inference>
- Apple Hardened Runtime: <https://developer.apple.com/documentation/security/hardened_runtime>
- Apple Managed Device Attestation: <https://support.apple.com/guide/deployment/managed-device-attestation-dep28afbde6a/web>
- AMD SEV-SNP: <https://www.amd.com/en/developer/sev.html>
- Confidential Containers: <https://confidentialcontainers.org/>
