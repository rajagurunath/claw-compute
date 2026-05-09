# Office Hours Summary — claw-marketplace

**Date:** 2026-05-10
**Mode:** Startup (YC Product Diagnostic)
**Status:** In progress — completed Q1, Q2, Q3. Q4–Q6 pending.

---

## Original Plan (as written)

A two-sided marketplace where:
- **Suppliers** install a sandboxed worker binary on their own hardware (laptops, DGX boxes) and offer it to consumers. Capabilities can include free inference (if local model present) and free OpenRouter credits.
- **Consumers** browse the marketplace, pick a supplier, and use sandboxed agents (OpenClaw / Hermes) for their workflows. MCP client or API to spin up sandboxes.
- **Economics:** Stripe payments. Marketplace takes 10–15%, supplier keeps the rest.
- **Security:** End-to-end encryption (Noise/Signal-style) so suppliers can't see what's running inside the agent.
- **Orchestration:** Temporal (PoC credits available).

---

## Q1 — Demand Reality

**First answer:** "Honestly, just my own intuition + market trends — inference is growing, AI compute is growing."

**Pushback:** Market trends aren't demand. Every competitor (io.net, Akash, Vast.ai, Render, Modal, Together, E2B, Daytona) cites the same trends. Designed solution-first; missing real human pain.

**Follow-up answer (the gold):**
> "I bought Wingman from an emergent app recently, which is a modified OpenClaw. I want a hosted setup, I don't want to lose my personal data on my laptop, I want a sandbox in the cloud, with skills pre-installed."

**The actual demand signal:** *You* are the user. You paid real money for a hosted, trusted, zero-setup agent sandbox. That's the only validated demand in the conversation.

**Reframe accepted:** The original "Airbnb for GPUs" framing was the wrong product. The real product is **"Fly.io / Uber for agents"** — consumer sees a Wingman-grade trusted hosted experience; the distributed supplier backend is invisible to them. Marketplace handles routing, trust scoring, economics behind the scenes.

---

## Q2 — Status Quo

**Answer:** Today, technical users who want this are renting VMs on RunPod / Fly / Modal / DigitalOcean and self-installing agent frameworks.

**Cost shape of the status quo:**
- ~$0.50/hr for a RunPod A10 → ~$360/mo if always-on
- Plus inference API costs (Claude / GPT / local)
- Plus hours of human time per project to set up skills, MCP servers, configs

**Your product's promise vs. status quo (4 distinct value props):**
1. Skip the VM setup
2. Skip the skill install
3. Free inference (when supplier has idle DGX)
4. Pay per-use, not per-hour

Any one of these could be a product on its own.

---

## Q3 — Desperate Specificity

**First answer:** "It's a B2C market — non-technical user who can't install or trust this themselves."

**Contradiction surfaced:** Q2 said the status quo persona is *technical* (rents RunPod, installs frameworks). Q3 said the customer is *non-technical*. These are different people with different products, prices, and distribution strategies. Classic "hypothetical users" trap — the validated user is yourself; the imagined user is someone you've never met.

**Resolution:** Picked technical audience as the customer. *"Pre-built agents, all powered up, with all the capabilities."*

---

## Locked-In Product Definition

| Field | Value |
|---|---|
| **Customer** | Technical user (developer, indie hacker, AI tinkerer — basically you and people like you). |
| **Pain** | Want to use OpenClaw / Hermes / agent stacks but (a) don't trust running on personal machine, (b) don't want hours of skill / MCP setup, (c) RunPod-and-self-install means paying for idle hours. |
| **Product** | Hosted, ready-to-go agent in a trusted sandbox, skills pre-installed, pay-per-use. |
| **Direct competitors** | Wingman, Manus, Replit Agents, hosted Claude Code / Codex offerings, E2B + bring-your-own-agent. |
| **Potential moat** | DGX / free-inference angle — *"this hosted agent comes with free local-model inference because some supplier's DGX is idle."* No one else can do this because no one else has io.net-style supply. **This was bullet 3 of your original plan and should be the headline.** |

---

## Key Insights from the Session

1. **Your strongest demand evidence is your own credit card charge to Wingman.** Don't bury it under market-trends talk again.
2. **The original plan solved the wrong problem.** "Airbnb for GPUs" optimizes for supplier monetization. Your demand evidence says consumers want hosted trust + zero setup, not a supplier-comparison UI. The product moved to "Fly.io / Uber for agents."
3. **The marketplace is now invisible to consumers.** They see one trusted product. Routing/reputation/economics is backend. This is much harder to build than the original plan but much more defensible.
4. **The DGX free-inference angle is the differentiator.** This is the one thing competitors (Wingman, Manus, Replit) cannot match. Promote it from buried bullet to headline.
5. **The plan as written is ~12 months of engineering for a team.** You are likely one person. Q4 (narrowest wedge) is where we'll cut it down to something shippable in days.

---

## Founder Signals Observed So Far

- **Honesty under pressure** — admitted "intuition + market trends" instead of dressing it up. Most founders won't.
- **Real first-person pain** — you bought Wingman. You felt the problem. That's worth more than 100 customer interviews.
- **Receptive to reframing** — accepted the "Fly.io for agents" reframe instead of defending the original plan.
- **Self-correction on persona** — caught and reversed your own B2C-vs-developer contradiction quickly.

---

## What's Still Open

Three more forcing questions to run before we have a design doc:

- **Q4 — Narrowest Wedge** — what's the smallest version someone pays $20 for THIS WEEK? The plan as written is enormous; we need to find the 1% of it that's a product on its own.
- **Q5 — Observation & Surprise** — have you watched anyone (yourself counts) actually use a hosted agent product without you helping? What surprised you?
- **Q6 — Future-Fit** — in 3 years, does this become more essential or less? Why (specific thesis, not "AI is growing")?

After Q4–Q6: Phase 3 (premise challenge), Phase 4 (2–3 alternative approaches), final design doc with assignment.

---

## Immediate Next Step

Resume office hours with Q4 to find the narrowest wedge. The candidate wedges to consider:

- **Hosted "Claude Code in a sandbox"** — one-click trusted instance, skills pre-loaded, pay per session.
- **DGX-backed free local inference** as a paid feature on top of an existing agent host.
- **A binary that lets a single supplier (you) host one agent for one paying user** — no marketplace, no supplier UX, no Stripe payouts, no Temporal. Just prove someone pays for the hosted experience.

The third option is closest to what you can ship this week.
