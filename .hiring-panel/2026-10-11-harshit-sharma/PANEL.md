# Hiring Panel Review: Harshit Sharma

**Target Role:** SDE-1 (Aug 2027 Start) in Big Tech  
**Date:** 2026-10-11

---

## The 7 Reviewer Verdicts

### 1. Automated Screening System (ATS)

- **Verdict:** REJECT
- **Filter Evaluation:**
  - Structure & Parsability: Standard single-column layout, standard headers.
  - Role Keywords & Competencies: Missing core production SWE keywords: Unit/integration testing (Jest, PyTest, Vitest), CI verification gates, latency SLIs/benchmarking, and concurrency guarantees.
  - Scale Thresholds: Low volume flags ("5 concurrent users", "20+ users") fail Big Tech backend scale filter queries.
  - Inconsistency: "built" in lowercase on project bullet; "Oct 2026 - Present" creates timeline discrepancy if applying before Oct 2026.
- **Top Reasons Quoted:**
  1. _"- Deployed backend on DigitalOcean with RBAC for multi-user WebSocket sessions; tested with 5 concurrent users who created 10+ repositories."_ — Below minimum concurrency thresholds for backend systems.
  2. _"- Built GitHub Actions CI/CD pipelines and managed a Turborepo setup for the department and convocation portals."_ — Zero mention of test suites, linting gates, or automated test coverage.
  3. _"- Built a Python RAG Prototype for querying healthcare insurance policy documents..."_ — Lacks evaluation benchmark metrics (precision/recall, latency, QPS).
  4. _"- built a Docker-sandboxed multi-language code execution service..."_ — Inconsistent casing ("built" vs capitalized action verbs).
  5. _"AI Engineer Intern Oct 2026 - Present"_ — Timeline anomaly when applying in cycles prior to late 2026.

---

### 2. The Hiring Manager

- **Verdict:** NO (Borderline / Waitlist for phone screen)
- **What decided it in the first 10 seconds:**
  - Strong pedigree (NIT Delhi CSE, 8.55 CGPA, 600+ LeetCode) and relevant modern technologies (Docker sandboxing, WebSockets, OT, GraphQL), but the bullets emphasize hobbyist scale ("5 users", "20+ users") rather than engineering depth, test discipline, or deep systems internals.
- **Questions for Interview:**
  1. _"Walk me through how ShareDB and Operational Transformation resolve conflicting concurrent operations across distributed client nodes when network packets arrive out of order or after a dropped WebSocket reconnection."_
  2. _"How did you enforce cgroup and seccomp isolation in your Docker sandbox to prevent container escapes or fork bombs during arbitrary untrusted code execution?"_
  3. _"How did your adaptive rate limiter for LeetCode's GraphQL endpoint handle token bucket exhaustion and backoff jitter without dropping sync events?"_
- **Three Weakest Lines:**
  1. _"- Deployed backend on DigitalOcean with RBAC for multi-user WebSocket sessions; tested with 5 concurrent users who created 10+ repositories."_ — Diminishes a technically complex project by declaring trivial load test numbers.
  2. _"- Built a Python RAG Prototype for querying healthcare insurance policy documents: ChromaDB for chunk storage, hybrid (semantic + keyword) retrieval and input/output guardrails, exposed as an API-invocable tool."_ — Reads like a generic weekend tutorial wrapper rather than an engineering accomplishment.
  3. _"- Solved 600+ coding problems across Leetcode and GFG."_ — Passive vanity metric without contest ratings (e.g., Codeforces rating, LeetCode Guardian/Knight).

---

### 3. Reader 1 — Day-One Engineering Manager (Can they ship on Day 1?)

- **Verdict:** MAYBE
- **The one line that hurt most:**
  > _"- Deployed backend on DigitalOcean with RBAC for multi-user WebSocket sessions; tested with 5 concurrent users who created 10+ repositories."_
- **Two more problems:**
  1. No mentions of automated testing (unit, integration, regression) or monitoring/observability (logging, Prometheus, Sentry).
  2. "Prototype" at Accenture indicates exploratory research rather than writing maintainable, production-ready code with teammates.

---

### 4. Reader 2 — Another Applicant (Competing Peer)

- **Verdict:** MAYBE
- **The one line that hurt most:**
  > _"- Solved 600+ coding problems across Leetcode and GFG."_
- **Two more problems:**
  1. Top contest percentile or rating is missing: 600+ problems is common among Indian tier-1/2 applicants; lacks CF/CodeChef contest ratings or LeetCode contest rank to back it up.
  2. The projects ("Collaborative Code Editor", "LeetCode Tracker") are standard college resume archetypes that lack unique open-source adoption or real active traffic.

---

### 5. Reader 3 — The CEO (Business & Leverage Impact)

- **Verdict:** PASS
- **The one line that hurt most:**
  > _"- Architected a LeetCode tracker (20+ users), migrating from Render + Neon free tier to a self-hosted VM (Caddy, PostgreSQL) after 5 min scheduled polling hit plan limits."_
- **Two more problems:**
  1. The reason for architectural migration is framed around avoiding free-tier pricing limits rather than solving real scaling, performance, or availability bottlenecks.
  2. In the AI internship, "detecting procedural deviations, non-compliance, and logical fallacies" lacks clarity on accuracy rate, hallucination containment, or validation methodology.

---

### 6. Reader 4 — The 30-Second Recruiter (Top-Third Scan)

- **Verdict:** PASS
- **The one line that hurt most:**
  > _"AI Engineer Intern Oct 2026 - Present"_
- **Two more problems:**
  1. The target is SDE-1 (core backend/systems), but the most prominent recent role is titled "AI Engineer Intern" with Streamlit/OpenAI wrapper work, causing immediate role-mismatch hesitation.
  2. Lack of a clear 1-line professional identity summary or target specialization; education and header lack direct links to live demo deployments.

---

### 7. Reader 5 — Future Teammate SDE (PR Quality, Systems Rigor & Collaboration)

- **Verdict:** MAYBE
- **The one line that hurt most:**
  > _"- built a Docker-sandboxed multi-language code execution service with per-language CPU/memory limits and execution timeouts."_
- **Two more problems:**
  1. Typo in casing ("built") and lack of mention of security sandboxing mechanisms (seccomp, namespaces, network isolation, cgroups).
  2. Skills section is a buzzword dump (listing both high-level wrappers like "MCP, Guardrails, Streamlit" alongside low-level "C/C++, SQL") with zero indication of depth or unit testing tooling.

---

## Merged List of Mistakes (Worst First)

1. **Self-Sabotaging Low Scale Numbers in Core Projects**
   - **Quoted Line:** `"- Deployed backend on DigitalOcean with RBAC for multi-user WebSocket sessions; tested with 5 concurrent users who created 10+ repositories."` & `"- Architected a LeetCode tracker (20+ users)..."`
   - **Why It Gets Rejected:** Putting "5 concurrent users" and "20+ users" turns an impressive technical stack (Docker sandboxes, Operational Transformation, Redis, Drizzle) into an obvious hobby project. Big Tech reviewers immediately downgrade candidate scope.
   - **Flagged By:** ATS, Hiring Manager, Day-One EM, Competing Applicant, CEO.

2. **Zero Automated Testing, CI Verification Gates, or Observability Mentioned**
   - **Quoted Line:** `"- Built GitHub Actions CI/CD pipelines and managed a Turborepo setup for the department and convocation portals."`
   - **Why It Gets Rejected:** Big Tech SDE-1 bars prioritize engineering hygiene. A resume with zero mentions of unit tests, integration testing, code coverage, or monitoring signals that the candidate hasn't learned enterprise engineering practices.
   - **Flagged By:** ATS, Day-One EM, Future Teammate SDE.

3. **Framing Migration Around Free Tier Plan Limits Instead of Architectural Scaling**
   - **Quoted Line:** `"- Architected a LeetCode tracker (20+ users), migrating from Render + Neon free tier to a self-hosted VM (Caddy, PostgreSQL) after 5 min scheduled polling hit plan limits."`
   - **Why It Gets Rejected:** "Hit plan limits on free tier" sounds amateurish. It highlights lack of optimization or architectural foresight. The engineering story should be about reducing polling overhead, self-hosting cost efficiency, and decoupling background sync workers.
   - **Flagged By:** CEO, Hiring Manager, Future Teammate SDE.

4. **Under-Engineered "Prototype" Framing for AI/Enterprise Work**
   - **Quoted Line:** `"- Built a Python RAG Prototype for querying healthcare insurance policy documents: ChromaDB for chunk storage, hybrid (semantic + keyword) retrieval and input/output guardrails, exposed as an API-invocable tool."`
   - **Why It Gets Rejected:** Labeling work as a "Prototype" without performance benchmarks (retrieval recall@k, latency, hallucination rate) signals non-production exploratory work.
   - **Flagged By:** ATS, Hiring Manager, CEO, Day-One EM.

5. **Inconsistent Syntax & Formatting Bugs**
   - **Quoted Line:** `"- built a Docker-sandboxed multi-language code execution service with per-language CPU/memory limits and execution timeouts."`
   - **Why It Gets Rejected:** Lowercase "built" among capitalized bullet points indicates carelessness in basic PR/document review.
   - **Flagged By:** ATS, Future Teammate SDE.

6. **Passive Metric Fluff in Competitive Accomplishments**
   - **Quoted Line:** `"- Solved 600+ coding problems across Leetcode and GFG."`
   - **Why It Gets Rejected:** Pure problem counts are easily gamed or inflated. Big Tech recruiters want contest performance (rating, Knight/Guardian, percentile) or contest rank.
   - **Flagged By:** Competing Applicant, Hiring Manager.

7. **Lack of Deep Systems & Security Details on Technical Implementations**
   - **Quoted Line:** `"- built a Docker-sandboxed multi-language code execution service with per-language CPU/memory limits and execution timeouts."`
   - **Why It Gets Rejected:** For SDE-1, implementing a code sandbox requires explaining isolation mechanisms (e.g., non-root user execution, cgroups, network isolation, ephemeral volume mounts) to show engineering depth rather than just calling `docker run`.
   - **Flagged By:** Future Teammate SDE, Hiring Manager.
