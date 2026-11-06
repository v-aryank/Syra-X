
SYRA X — User Interface Specification (UI-Spec)
Document status: Baseline specification
Version: 1.0
Last updated: 2026-11-06

1. Design direction
SYRA X should feel like a focused, futuristic assistant workspace. Its identity comes from the animated core and carefully controlled blue lighting—not from filling every surface with effects.

Visual keywords
dark navy / midnight foundation;
electric blue and sapphire highlights;
subtle cyan accents;
layered depth, soft glow, and restrained glass-like surfaces;
technical monospace labels used selectively;
highly readable conversation typography.
Avoid a flat, one-color interface, excessive neon, noisy backgrounds, and decorative effects that compete with messages.

2. Design principles
Core is the identity: the animated sphere is visually prominent but must not obstruct the conversation.
Conversation is primary: messages, source links, and composer remain easy to read and use.
State is visible: the core and status label communicate what SYRA is doing.
Motion has meaning: animation changes should correspond to assistant states.
Progressive enhancement: voice controls appear or become disabled based on browser support; text chat always works.
Responsive first: the mobile experience is a deliberate layout, not a compressed desktop layout.
3. Desktop layout
Recommended desktop composition:

Main workspace uses a two-region layout.
Core region: sphere, status label, and concise connection/activity information.
Conversation region: message history, source references, and composer.
Conversation region receives sufficient width for readable text.
Navigation/settings are compact and should not dominate the workspace.
The core and conversation should be independently scrollable only where necessary. Avoid nested scrolling that makes the interface difficult to operate.

4. Mobile layout
Prioritize the conversation and composer.
Keep the core compact; it may sit above the conversation or in a collapsible/condensed header region.
Composer and microphone controls must remain reachable without awkward horizontal scrolling.
Respect safe areas and the on-screen keyboard.
Use touch targets large enough for reliable tapping.
Do not hide essential status or error information behind hover-only interactions.
5. SYRA core visualization
Source reference
The existing PyQt6 implementation is the visual reference. Preserve its recognizable visual language and behavior: particle sphere, particle motion/distribution, organic glow/ring effects, and energy/state changes.

The PyQt6 widget itself is not a browser component. Reimplement the rendering layer in browser technology while keeping the assistant's application logic in Python.

Rendering requirements
Use Canvas 2D or Three.js based on the complexity and performance needs established during implementation.
Keep the renderer isolated from chat and API components.
Accept a small state/energy interface rather than importing application-wide state directly.
Support resize and device pixel ratio responsibly.
Pause or reduce animation when the page is hidden or when reduced-motion preference is enabled.
Avoid excessive GPU/CPU usage on mobile devices.
Maintain a graceful fallback if advanced rendering is unavailable.
Visual states
State	Visual direction
idle	Calm, slow particle motion and stable glow
listening	More responsive/pulsing energy; clear active indication
thinking	Increased internal movement or energy flow
searching	Optional distinct orbit/ring cue layered over thinking
speaking	Smooth rhythmic response while speech is active
These are visual directions, not pixel-perfect animation values. Match the original Python reference where its behavior is clear.

6. Typography
Primary UI and conversation text: readable sans-serif.
Technical labels, telemetry, and compact status text: monospace or Terminus-like font.
Display text may use a futuristic geometric face sparingly.
Do not use a stylized font for long assistant messages.
Maintain sufficient font size and line height on mobile.
7. Color and effects
Suggested semantic palette (final values may be tuned during implementation):

Token	Intended use	Suggested value
background	Main page	#070B16
surface	Panels	#0D1424
surface-raised	Elevated controls	#121D32
text-primary	Main text	#EAF1FF
text-secondary	Supporting text	#9AAAC5
accent	Primary SYRA blue	#3478F6
accent-bright	Active glow	#55B8FF
accent-muted	Quiet blue detail	#203D70
border	Subtle separators	#1D2A42
error	Errors	#F16B78
success	Confirmed success	#55C99A
Use semantic tokens so colors can be changed centrally. Glow should be localized to the core and active controls.

8. Conversation components
Each message should communicate its role clearly. Assistant messages may include:

readable response text;
optional grounded/search-assisted indicator;
source list when grounding metadata is available;
optional speech playback control.
Source links must be recognizable as links and open safely. Do not render arbitrary HTML from model output.

9. Composer and controls
Composer requirements:

multiline text input;
send action;
microphone action when recognition is supported;
clear listening/recording state;
keyboard submission behavior that does not prevent multiline entry;
visible disabled/loading states;
no message submission when content is empty.
Voice output controls:

play/speak when supported and appropriate;
stop/cancel while speaking;
language selection in settings if multiple usable options exist.
10. Accessibility
All controls must have accessible names.
Keyboard navigation and visible focus indicators are required.
Do not communicate state using color alone.
Respect prefers-reduced-motion.
Provide text labels or live-region announcements for important status changes.
Ensure source links and controls have adequate contrast.
Maintain usable zoom and responsive reflow.
11. UI states to design and test
initial loading;
ready/idle;
listening;
thinking;
searching (if distinct);
speaking;
empty conversation;
conversation with long messages;
grounded answer with multiple sources;
backend disconnected;
provider error/rate limit;
microphone denied;
speech recognition unsupported;
speech synthesis unsupported;
mobile keyboard open;
reduced-motion enabled.
12. UI implementation boundary
React owns application UI and state. The core renderer receives explicit state and sizing inputs. The backend does not render UI or expose provider credentials. Keep visual implementation details out of provider and persistence modules.

