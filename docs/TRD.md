
SYRA X — Technical Requirements Document (TRD)
Document status: Baseline specification
Version: 1.0
Last updated: 2026-11-06

1. Architecture summary
SYRA X uses a web frontend with a Python backend:

Frontend: React + Vite, JavaScript, CSS/Tailwind as selected during setup.
Backend: Python + FastAPI.
AI provider: Google Gemini through the official google-genai Python SDK.
Grounding: Gemini Google Search grounding when useful and supported by the selected model/API configuration.
Voice: Browser Web Speech APIs—speech recognition and speech synthesis.
Persistence: SQLite for local development/initial single-instance setup; PostgreSQL for production when persistent multi-process hosting is required.
Core visualization: Browser Canvas 2D or Three.js, ported from the existing PyQt6 reference behavior.
The frontend must never call Gemini directly with a private API key.

2. System boundaries
Frontend responsibilities
render the assistant workspace and conversation history;
manage client-side interaction state;
run the browser speech APIs;
render the animated core;
call the backend API;
render grounded source links returned by the backend;
handle loading, connection, and permission feedback.
Backend responsibilities
validate and normalize incoming requests;
manage conversations and message history;
orchestrate Gemini requests;
decide/request Google Search grounding when appropriate;
extract provider response text and grounding metadata;
persist messages and conversation metadata;
enforce rate limits, timeouts, and safe error handling;
keep API keys and provider configuration server-side.
Provider responsibilities
Gemini generates assistant responses. Google Search grounding, when enabled for a request, supplies grounding metadata that the backend passes to the frontend.

3. Proposed repository structure
Syra-X/
├── AGENTS.md
├── README.md
├── PRD.md
├── AppFlow.md
├── UI-Spec.md
├── TRD.md
├── Schema.md
├── Plan.md
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── app/
│       ├── components/
│       │   ├── core/
│       │   ├── chat/
│       │   ├── voice/
│       │   ├── layout/
│       │   └── settings/
│       ├── hooks/
│       ├── services/
│       ├── state/
│       └── styles/
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   ├── services/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── database/
│   └── tests/
├── reference/
│   └── original-python-core/
│       └── syra_core.py
└── docs/
    └── decisions/
This is a proposed structure. Keep the original uploaded/reference Python file unchanged; if it is copied into the repository, record its provenance and do not silently rewrite it.

4. Backend technology requirements
Python version: select and pin a currently supported version during environment setup; use the same version in local instructions and deployment.
FastAPI for HTTP API.
Pydantic models for request/response validation.
Official google-genai SDK for Gemini.
SQLAlchemy or another explicitly selected persistence layer; avoid mixing database access patterns.
Alembic migrations if SQLAlchemy is selected and schema evolution requires migrations.
pytest for backend tests.
httpx/FastAPI test client for API testing.
Do not use the legacy google-generativeai SDK for new implementation unless a documented compatibility reason is established.

5. Frontend technology requirements
React with Vite.
JavaScript as the initial project language unless the product owner explicitly approves TypeScript.
Tailwind CSS may be used for styling, with centralized design tokens.
Browser APIs must be feature-detected.
Core visualization must be isolated from chat components.
Use a single API service layer rather than scattering fetch calls through components.
Keep animation state and conversation state separate.
6. API contract (initial proposal)
All endpoints should be versioned under /api/v1.

GET /api/v1/health
Returns service health without exposing environment variables or secrets.

Example:

{
  "status": "ok",
  "service": "syra-x-api"
}
POST /api/v1/conversations
Creates a conversation.

Example response:

{
  "id": "conversation-id",
  "title": "New conversation",
  "created_at": "2026-11-06T12:00:00Z"
}
GET /api/v1/conversations
Lists conversations available to the current deployment's ownership/session context.

GET /api/v1/conversations/{conversation_id}
Returns conversation metadata and messages after access validation.

DELETE /api/v1/conversations/{conversation_id}
Deletes a conversation and its messages only if deletion is included in the approved retention policy. Implement transactionally.

POST /api/v1/chat
Request:

{
  "conversation_id": "conversation-id",
  "message": "Explain this topic."
}
Response:

{
  "conversation_id": "conversation-id",
  "message": {
    "id": "message-id",
    "role": "assistant",
    "content": "Response text"
  },
  "model": "configured-model-id",
  "grounded": false,
  "sources": []
}
The response contract may be extended for streaming, usage metadata, or structured errors. Keep it documented and versioned. Do not expose internal provider objects directly.

7. Gemini integration
Use the official google-genai SDK on the backend.
Read the API key from a backend environment variable such as GEMINI_API_KEY.
Keep the model identifier configurable through a backend environment variable.
Use a provider service module; do not call the SDK from route handlers or frontend code.
Apply request timeouts and handle provider errors explicitly.
Preserve grounding metadata and source URLs when search grounding is used.
Verify the exact SDK method and grounding configuration against the installed SDK version and chosen Gemini model during implementation. Provider APIs can change; do not hardcode unverified examples as final implementation.
Do not claim grounding is active unless the provider response confirms it.
8. Voice integration
Use browser speech APIs from dedicated frontend hooks/services.

Speech recognition:

detect the relevant browser API at runtime;
request activation only after user action;
support interim/final results where available;
stop recognition on user request and on appropriate lifecycle changes;
handle permission and network errors;
default to review-before-send.
Speech synthesis:

detect speechSynthesis;
wait for voices to become available where necessary;
select the best available voice for the chosen language;
expose stop/cancel behavior;
retain text as the fallback.
The Web Speech API is not uniformly supported and may use browser/vendor services. Do not promise identical behavior or privacy characteristics across browsers.

9. Core visualization migration
The original PyQt6 core is the visual reference, not a directly reusable browser widget.

Migration approach:

Inspect the original code and identify visual parameters, particle model, geometry, motion, glow, and state/energy behavior.
Separate visual behavior from PyQt-specific painting and timer APIs.
Implement browser rendering using Canvas 2D or Three.js.
Expose a narrow interface such as setState(state) and setEnergy(value).
Compare browser output with the reference at matching sizes and states.
Profile performance on desktop and mobile.
Keep renderer lifecycle, resize, visibility, and cleanup behavior explicit.
Do not duplicate assistant orchestration in JavaScript just to reproduce the visualization. Python remains responsible for backend assistant logic.

10. Security requirements
Never put Gemini keys in VITE_* variables, frontend source, HTML, or browser storage.
Store secrets in backend environment variables or the deployment's secret manager.
Configure CORS with explicit frontend origins; do not use unrestricted wildcard origins with credentials.
Validate message length, conversation IDs, and request bodies.
Add per-client/session rate limits before public deployment.
Apply request timeouts and bounded provider retries.
Avoid logging full secrets, authorization headers, or unnecessary message content.
Treat user messages and retrieved web content as untrusted input.
Render model output as text; do not inject arbitrary HTML.
Validate and sanitize outbound source URLs before rendering links.
Use HTTPS in production.
Do not expose stack traces or internal provider errors to end users.
11. Persistence and deployment
Development
SQLite is suitable for local development and early single-instance testing. Store the database outside ephemeral build output and exclude it from Git.

Production
Use PostgreSQL or another durable managed database if the hosting platform has ephemeral filesystems, multiple instances, or concurrent request requirements. Verify connection pooling, migrations, backups, and retention.

Hosting
Frontend may be deployed to Vercel or another static frontend host. Backend may be deployed to Render or an equivalent Python host. A single-platform deployment is acceptable only after verifying Python runtime support, streaming behavior (if used), request limits, persistent storage, and database connectivity.

12. Testing requirements
unit tests for provider orchestration and response parsing;
API tests for validation, error handling, conversation isolation, and persistence;
tests for grounded source extraction using representative fixtures;
frontend tests for composer, state transitions, and source rendering;
manual browser tests for voice permission, unsupported APIs, stop behavior, and language availability;
responsive and reduced-motion checks;
deployment smoke tests with a non-production API key.
13. Environment variables
Backend .env.example should document names and safe placeholders only:

GEMINI_API_KEY=replace_with_server_side_key
GEMINI_MODEL=replace_with_verified_model_id
DATABASE_URL=sqlite:///./syra_x.db
FRONTEND_ORIGINS=http://localhost:5173
APP_ENV=development
Do not commit .env files containing real secrets. Frontend environment variables may contain public configuration only, never provider credentials.

14. Technical decisions requiring verification
Gemini model and exact SDK grounding configuration;
streaming vs non-streaming v1 response;
database library and migration strategy;
session/ownership strategy for conversation access;
Canvas 2D vs Three.js after inspecting the original core;
production hosting and persistent database;
browser support matrix for speech APIs.
