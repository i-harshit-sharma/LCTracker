# Harshit Sharma

+91 9509649232 | harshitsharma9232@gmail.com | linkedin.com/in/harshit163 | github.com/i-harshit-sharma | Jaipur, India

---

## EDUCATION

**National Institute of Technology, Delhi**  
_Bachelor of Technology in Computer Science and Engineering_ | **CGPA: 8.55 / 10**  
_Graduation:_ June 2027  
_Relevant Coursework:_ Data Structures & Algorithms, Operating Systems, Database Management Systems, Object-Oriented Programming, Computer Networks, Distributed Systems [ASSUMED], Information Security.

---

## WORK EXPERIENCE

### **Fusion Finance** — AI Engineer Intern

_Gurugram, Haryana_ | _Oct 2026 – Present_

- Engineered an automated batch Video Personal Discussion (PD) analytics pipeline utilizing FFmpeg, Sarvam AI, and OpenAI to process asynchronous applicant video streams.
- Accelerated credit auditing workflow by **30%** (reducing review latency from 15 mins to 10 mins per case) by building automated anomaly detection for procedural compliance deviations, policy non-conformance, and audit inconsistencies.
- Implemented robust error-handling and automated validation pipelines [ADD: What was the precision/recall or validation error rate?] to ensure reliable automated extraction for credit evaluation teams.

### **Accenture** — Custom Software Engineering Intern

_Bengaluru, Karnataka_ | _Jun 2026 – Jul 2026_

- Developed a high-accuracy Retrieval-Augmented Generation (RAG) service querying healthcare insurance policy documentation, deployed as a secure internal microservice API.
- Implemented hybrid search combining dense semantic vector search (ChromaDB) with sparse keyword retrieval, achieving improved document retrieval accuracy [ADD: Specific retrieval benchmark or latency, e.g. <200ms p95 latency].
- Configured programmatic input/output safety guardrails, token-cost telemetry, and structured validation schemas to eliminate hallucinated policy clauses.

### **NIT Delhi** — Web Development Intern

_Delhi, India_ | _Jun 2025 – Jul 2025_

- Migrated institution web portal serving **50,000+ monthly visitors** from legacy WordPress to Next.js and Tailwind CSS, reducing page load times by **20%** and elevating Lighthouse mobile performance score by **15 points**.
- Designed and maintained GitHub Actions CI/CD pipelines with automated linting, type-checking, and build validation across a Turborepo monorepo supporting department and convocation portals.
- Established reproducible development environments and standardized PR verification gates [ADD: automated unit/integration test coverage percentage].

---

## PROJECTS

### **Collaborative Code Editor** | _React, Express, Clerk, MongoDB, Docker, Socket.io, ShareDB_

_Aug 2025 – Dec 2025_ | [Live Demo / GitHub Link]

- Built real-time collaborative state synchronization for multi-file code editing, whiteboard, and messaging using Socket.io and ShareDB (Operational Transformation algorithm) to resolve concurrent edit conflicts with sub-50ms sync latency [ASSUMED].
- Architected an isolated code execution engine using Docker containers with strict per-process CPU, memory cgroups, network sandboxing, and execution timeouts to prevent denial-of-service and unauthorized system access.
- Implemented RBAC-governed WebSocket sessions with persistent state persistence, validating connection reliability and session stability across concurrent client sessions [ADD: stress test throughput or benchmark results, e.g., verified across 100+ simulated concurrent connections].

### **LCTracker (Distributed Sync & Progress Visualizer)** | _React, Express, PostgreSQL, Caddy, Drizzle ORM, Resend_

_Mar 2026 – Aug 2026_ | [Live Demo / GitHub Link]

- Architected a full-stack LeetCode activity tracking and 3D skyline analytics platform, migrating infrastructure to a self-hosted Linux VM with Caddy reverse proxy and PostgreSQL to support unconstrained cron polling and persistent data retention.
- Engineered an adaptive token-bucket rate limiter with exponential backoff and SHA-256 state deduplication for external LeetCode GraphQL synchronization, eliminating dropped sync calls.
- Designed an event-driven notification pipeline using Web Push APIs and Resend for transactional user alerts, maintaining comprehensive database schema migrations via Drizzle ORM.

---

## TECHNICAL SKILLS

- **Languages:** C++, Python, TypeScript, JavaScript, SQL, C.
- **Backend & Systems:** Express.js, Node.js, Socket.io, RESTful APIs, Operational Transformation, WebSocket, Microservices Architecture.
- **Frontend:** React.js, Next.js, Tailwind CSS, HTML5/CSS3.
- **Databases & Storage:** PostgreSQL, MySQL, MongoDB, Redis, ChromaDB.
- **DevOps, Cloud & Tooling:** Docker, Linux, GitHub Actions CI/CD, Turborepo, Git, Caddy, DigitalOcean.
- **Testing & Quality Assurance [ADD: Confirm testing libraries used]:** Vitest, Jest, Postman, Supertest, Unit Testing, Integration Testing.

---

## ACHIEVEMENTS & COMPETITIVE PROGRAMMING

- **HackOn With Amazon (Season 5):** Ranked in **Top 3.5%** nationwide among **50,000+ participants** in competitive coding assessment.
- **TrueFoundry GenAI Case Competition (IIT Kharagpur):** Ranked among **Top 10 teams** out of **900+ teams**; designed governance and enterprise adoption architecture for LLM workflows.
- **Competitive Programming:** Solved **600+ problems** across LeetCode and GeeksforGeeks [ADD: Current LeetCode Contest Rating / Knight badge or Codeforces/CodeChef rating].

---

### Clarification Items to Finalize `[ADD: ...]`:

1. _Testing suite:_ What test frameworks did you use for the Collaborative Code Editor or LCTracker (e.g., Vitest, Jest, PyTest)?
2. _Competitive Programming Rating:_ What is your maximum LeetCode contest rating (or badge, e.g., Knight / Top X%) or Codeforces rating?
3. _Code sandbox scale:_ Can we state load testing metrics (e.g., "benchmarked up to 100 concurrent WebSocket sessions with 0 dropped events")?
4. _Accuracy/eval metrics:_ Do you have an estimate of the accuracy or latency in the Accenture RAG and Fusion Finance audit pipeline?
