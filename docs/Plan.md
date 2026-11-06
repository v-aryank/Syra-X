
SYRA X — Development Plan
Document status: Baseline phased plan
Version: 1.0
Last updated: 2026-11-06

1. Delivery strategy
Build SYRA X in small, verifiable phases. Each phase should leave the repository in a runnable or testable state. Do not start a later phase while the current phase has unresolved foundational issues.

The architecture documents and AGENTS.md are the project source of truth. Update them when an approved decision changes.

2. Phase 0 — Documentation and repository foundation
Goal: Establish a clear, consistent project baseline.

Tasks:

add the six architecture documents and AGENTS.md;
add a project README.md;
establish repository folder structure;
add .gitignore and backend .env.example;
preserve the original Python core in a reference location if the source file is available;
record key architecture decisions.
Exit criteria:

docs agree with each other;
no secrets or generated environments are committed;
repository structure is clear;
initial commit is clean.
3. Phase 1 — Frontend/backend skeleton
Goal: Create a runnable React frontend and FastAPI backend.

Tasks:

initialize Vite + React frontend;
initialize FastAPI backend;
add health endpoint;
configure local development CORS;
add a shared API service in frontend;
add environment examples and setup instructions;
add minimal smoke tests.
Exit criteria:

frontend starts locally;
backend starts locally;
frontend can reach health endpoint;
tests pass.
4. Phase 2 — SYRA core migration
Goal: Recreate the recognizable sphere in the browser.

Tasks:

inspect the original PyQt6 code;
identify particle generation, motion, glow, ring effects, energy mapping, and state behavior;
separate visual rules from PyQt-specific APIs;
select Canvas 2D or Three.js based on the source and prototype;
implement renderer lifecycle, resize, visibility handling, and reduced-motion behavior;
compare browser visuals with the original reference.
Exit criteria:

core renders independently of chat;
supports idle, listening, thinking, and speaking;
no major performance issue on target desktop and mobile browsers;
original source remains preserved.
5. Phase 3 — Assistant workspace UI
Goal: Build the core user experience without provider dependency.

Tasks:

implement desktop and mobile layouts;
build conversation list/history presentation;
build message bubbles and source-list component;
build composer and send/loading/error states;
connect UI state to core visualization;
implement accessible controls and reduced-motion support.
Exit criteria:

UI can be exercised with mocked responses;
responsive layouts pass manual checks;
keyboard navigation and core state transitions work.
6. Phase 4 — Gemini backend integration
Goal: Deliver real assistant responses securely.

Tasks:

install and pin official google-genai SDK;
configure server-side Gemini key and model;
implement provider service abstraction;
implement normalized request/response schemas;
implement conversation context assembly;
implement Google Search grounding when useful;
parse and preserve source metadata;
add timeouts, bounded retries, and safe provider errors;
add unit and API tests.
Exit criteria:

valid key returns assistant response;
follow-up uses only the correct conversation context;
grounding metadata and links are returned when available;
invalid key, timeout, and rate limit are handled;
no secret reaches frontend.
7. Phase 5 — Browser voice
Goal: Add optional speech input and output.

Tasks:

implement feature detection;
implement explicit-start speech recognition;
default to transcript review before sending;
implement language selection based on actual browser support;
implement speech synthesis and stop control;
implement permission-denied and unsupported fallbacks;
connect voice states to the core.
Exit criteria:

voice input works in supported test browsers;
speech output works when a usable voice exists;
stop/interrupt works;
typed chat remains functional in every fallback case.
8. Phase 6 — Persistence, quality, and hardening
Goal: Make the application reliable beyond a local demo.

Tasks:

implement conversation and message persistence;
implement ownership/isolation checks;
define and implement deletion/retention behavior;
add database migrations if needed;
add rate limiting and request validation;
test long messages, errors, reloads, and concurrent requests;
perform responsive, accessibility, and performance checks;
review logging and secret handling.
Exit criteria:

saved conversations reload correctly;
conversation isolation tests pass;
no critical security issue remains;
documented tests pass.
9. Phase 7 — Deployment and release
Goal: Publish a stable first release.

Tasks:

choose frontend/backend/database hosting;
configure production environment variables and CORS;
provision durable database and backups;
deploy staging first;
run smoke tests against staging;
configure HTTPS and operational logging;
document setup, known limitations, and release version;
tag the release after acceptance criteria pass.
Exit criteria:

production app is reachable;
provider key remains server-side;
database persistence verified after deployment restart;
core chat, grounding, and supported voice paths tested;
README matches actual deployment.
10. Definition of done
A task is complete only when:

implementation matches the approved documents;
relevant tests are added or updated;
errors and edge cases are considered;
no secrets or temporary files are committed;
documentation is updated where behavior or setup changed;
the feature is manually verified where browser/device behavior is involved.
11. Change control
If a new feature is proposed:

identify whether it is in v1 scope;
describe user value and technical impact;
update PRD and relevant flow/UI/technical/schema docs;
update the plan and acceptance criteria;
implement only after the scope decision is explicit.
12. Progress tracking
Track each task in the repository issue tracker or project board. Do not mark a phase complete based only on code being present; use its exit criteria and test evidence.

