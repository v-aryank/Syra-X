
SYRA X
A browser-based conversational AI assistant with a state-aware animated core, optional browser voice interaction, and Gemini-powered responses with Google Search grounding when useful.

Status: Phase 1 foundation. The React/Vite shell and FastAPI health endpoint are implemented; assistant, persistence, voice, and browser core features remain future phases.

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
Requirements: Python 3.12.3 and Node.js 22.23.3 (also recorded in `backend/.python-version` and `frontend/.nvmrc`). The frontend uses pinned npm dependencies; the backend uses pinned Python dependencies.

### Backend (terminal 1)

```bash
cd backend
if [ ! -d venv ]; then python3.12 -m venv venv; fi
source venv/bin/activate
pip install -r requirements.txt
[ -f .env ] || cp .env.example .env
# Edit FRONTEND_ORIGINS only if your frontend uses a different origin.
set -a
source .env
set +a
./venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Expected local API base URL: `http://127.0.0.1:8000`
FastAPI docs: http://127.0.0.1:8000/docs

### Frontend (terminal 2)

```bash
cd frontend
npm install
[ -f .env ] || cp .env.example .env
npm run dev
```

Expected local frontend URL: `http://localhost:5173`
Stop either server with `Ctrl+C` in its terminal. Keep `backend/venv/`, frontend `node_modules/`, and local `.env` files untracked; `.gitignore` excludes them.

The frontend reads the public backend URL from `VITE_API_BASE_URL` in `frontend/.env`. It defaults to `http://127.0.0.1:8000`. The current page checks `/api/v1/health` and displays connection status.

Environment configuration
Backend configuration is documented in `backend/.env.example`:

FRONTEND_ORIGINS=http://localhost:5173
APP_ENV=development

Gemini and database configuration are not active in this foundation phase. Never commit a real `.env` file or expose provider credentials through frontend variables or browser code.

Backend verification: from `backend/`, activate `venv` and run `pytest`. The health endpoint is `GET /api/v1/health` and returns `{"status":"ok","service":"syra-x-api"}`.
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

