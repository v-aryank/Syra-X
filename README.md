
SYRA X
A browser-based conversational AI assistant with a state-aware animated core, optional browser voice interaction, and Gemini-powered responses with Google Search grounding when useful.

Status: Architecture and documentation baseline. Implementation status must be verified from the repository; this README does not imply that features are already implemented.

Vision
SYRA X brings together:

a recognizable animated SYRA sphere adapted from the original PyQt6 reference;
a React web interface;
a Python FastAPI backend;
Google Gemini through the official google-genai SDK;
optional browser speech recognition and speech synthesis;
conversation context and persistence;
Google Search grounding and source links when available.
Architecture at a glance
Browser
  React + Vite
  ├── Assistant workspace / chat
  ├── Browser voice APIs
  └── SYRA core renderer (Canvas 2D or Three.js)
            │ HTTPS / JSON API
            ▼
Python FastAPI backend
  ├── Conversation API and context
  ├── Gemini provider service
  ├── Google Search grounding
  └── Persistence layer
            │
            ├── Gemini API
            └── SQLite (development) / PostgreSQL (production as needed)
Python remains responsible for assistant orchestration and backend logic. The sphere's rendering must be adapted for the browser because a PyQt6 widget cannot run natively inside a normal web page.

Repository documentation
File	Purpose
PRD.md	Product goals, scope, requirements, and acceptance criteria
AppFlow.md	User journeys and assistant state transitions
UI-Spec.md	Visual system, layout, core, and interaction requirements
TRD.md	Stack, architecture, API, provider, security, and deployment
Schema.md	Logical data model and isolation rules
Plan.md	Phases, exit criteria, and delivery workflow
AGENTS.md	Mandatory instructions for AI coding agents
Read AGENTS.md and the six architecture documents before substantial implementation.

Planned repository layout
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
├── backend/
├── reference/
│   └── original-python-core/
└── docs/
The actual repository may be at an earlier stage. Add folders as their corresponding development phase begins.

Requirements
Node.js version compatible with the selected Vite release.
Python version selected and pinned during backend setup.
A Gemini API key for real AI responses.
A modern browser. Voice features depend on browser and device support.
Local development
The commands below are the intended workflow once the frontend and backend have been initialized. They are not runnable until the corresponding project files exist.

Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add GEMINI_API_KEY to backend/.env
uvicorn app.main:app --reload
Expected local API base URL: http://127.0.0.1:8000

Frontend
In a second terminal:

cd frontend
npm install
npm run dev
Expected local frontend URL: http://localhost:5173

Use the actual scripts and ports defined by the implementation if they differ; update this README accordingly.

Environment configuration
Backend configuration should be documented in backend/.env.example. Expected settings include:

GEMINI_API_KEY=replace_with_server_side_key
GEMINI_MODEL=replace_with_verified_model_id
DATABASE_URL=sqlite:///./syra_x.db
FRONTEND_ORIGINS=http://localhost:5173
APP_ENV=development
Never commit a real .env file.
Never expose GEMINI_API_KEY through frontend variables or browser code.
Verify the selected Gemini model and Google Search grounding configuration against the installed SDK version.
Voice support
Voice is an optional browser capability:

speech recognition for microphone input;
speech synthesis for spoken responses;
typed chat and text responses remain available as fallbacks.
The browser may use platform or vendor speech services. Support and available voices vary by browser, operating system, and language. Microphone access must be initiated by the user.

Development roadmap
Documentation and repository foundation.
React/FastAPI skeleton and health check.
Browser migration of the SYRA core.
Assistant workspace UI.
Gemini and grounding integration.
Browser voice.
Persistence, testing, and hardening.
Deployment and release.
See Plan.md for phase tasks and exit criteria.

Security
Keep provider keys on the backend.
Validate all API inputs.
Restrict CORS to known frontend origins.
Scope conversation access to a trusted owner/session context.
Use HTTPS in production.
Apply rate limits and timeouts before public deployment.
Treat retrieved web content as untrusted.
Do not render arbitrary model-generated HTML.
Current limitations and open decisions
The following remain implementation decisions until verified:

exact Gemini model identifier and grounding configuration;
streaming vs non-streaming responses for v1;
final database and production hosting;
conversation ownership and retention policy;
Canvas 2D vs Three.js selection after inspecting the original core;
tested browser support for English and Bangla speech.
Contributing / AI-assisted development
Follow AGENTS.md. Keep changes focused, add tests, update documentation when behavior changes, and report what was actually verified. Do not claim a feature is complete solely because code has been generated.

License
Add the selected license file and update this section before public release.

