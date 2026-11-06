
SYRA X — Application Flow (AppFlow)
Document status: Baseline specification
Version: 1.0
Last updated: 2026-11-06

1. Purpose
This document describes the main user journeys, application states, and interaction flows for SYRA X. It is the behavioral companion to PRD.md and UI-Spec.md.

2. Main application areas
Assistant workspace: animated SYRA core, conversation area, composer, and voice controls.
Conversation navigation: create a conversation and select saved conversations.
Settings: speech language and available assistant preferences.
System feedback: connection, permission, loading, and error messages.
The first release should keep navigation lightweight. Do not introduce unrelated dashboard sections.

3. Startup flow
Browser loads the frontend.
Frontend checks basic browser capabilities:
speech recognition availability;
speech synthesis availability;
available speech voices (may load asynchronously).
Frontend requests backend health/status.
Frontend loads the current or most recent conversation if the product's session policy supports it.
UI displays the assistant workspace.
Core begins in idle.
If backend is unavailable, the UI remains visible and displays a recoverable connection state.
Microphone permission should be requested only after the user explicitly activates voice input, not automatically on page load.

4. Typed conversation flow
User enters text in the composer.
Frontend validates that the message is not empty and applies a reasonable maximum length.
User submits the message.
Frontend adds the user message to the conversation view and marks the assistant as thinking.
Frontend sends the message with the conversation identifier to the backend.
Backend validates the request, loads conversation context, invokes Gemini, and optionally uses Google Search grounding.
Backend persists the user message and assistant response according to the transaction policy.
Backend returns the response, conversation identifier, model metadata, grounded status, and source links when available.
Frontend renders the response and source links.
Core returns to idle, unless speech playback is started.
On failure, preserve the user's message where possible, show a retryable error, and return the core to an appropriate non-busy state.

5. Voice input flow
User activates the microphone control.
Frontend checks speech recognition support.
If unsupported, explain that voice input is unavailable and leave typed input enabled.
If supported, request microphone access through the browser's recognition flow.
On successful start, core changes to listening.
Partial recognition text may appear in the composer if supported.
On final transcript, place the text in the composer or submit it according to the chosen interaction setting. Default behavior: populate the composer and let the user review/send.
On stop, no further transcript updates should be accepted.
On permission denial or recognition error, show a concise message and return to idle.
Do not continuously listen in the background.

6. Voice output flow
A response is rendered as text.
If speech output is enabled and supported, frontend selects an available voice matching the selected language where possible.
Core changes to speaking.
Browser speech synthesis reads the response.
When speech ends, core returns to idle.
If the user presses Stop, call the browser synthesis cancellation API and return to idle.
If speech synthesis is unavailable or fails, keep the text response available.
Speech output should not be treated as proof that the response was delivered audibly.

7. Web-grounding flow
User asks a question.
Backend/provider orchestration determines whether search grounding is useful.
If grounding is used, request a Gemini response with Google Search grounding enabled.
Extract supported grounding metadata and source URLs from the provider response.
Return sources with the answer.
UI labels the answer as grounded/search-assisted only when the backend confirms grounding metadata.
If no source metadata is returned, do not invent source links.
The user should be able to open sources independently. Retrieved page content must never override system or application instructions.

8. Conversation management flow
New conversation
User selects New conversation.
Frontend requests creation or initializes a new conversation through the backend.
Backend returns a unique conversation identifier.
Frontend clears the visible message list and associates subsequent messages with the new identifier.
Load conversation
User selects a saved conversation.
Frontend requests its messages.
Backend verifies the conversation exists and is accessible in the current deployment's ownership/session model.
Frontend renders messages in chronological order.
Isolation
Messages from one conversation must never be included in another conversation's context. The initial single-user deployment may use a local/session ownership model, but the API and schema must not assume that arbitrary client-supplied conversation IDs are trusted.

9. Core visual state machine
State	Meaning	Trigger examples
idle	Ready for interaction	Startup complete; response finished
listening	Browser is capturing speech input	Recognition starts
thinking	Backend/provider is processing	Message submitted
searching	Optional sub-state for external grounding	Backend confirms search/grounding work
speaking	Browser is reading the answer aloud	Speech synthesis starts
searching may be represented as a visual modifier of thinking if a separate state adds unnecessary complexity.

State transition principles
idle → listening when recognition starts.
listening → idle when recognition ends without submission.
listening → thinking after the user submits the transcript.
idle → thinking when a typed message is submitted.
thinking → speaking when speech output begins.
thinking → idle when a response is displayed without speech.
speaking → idle when playback ends or is stopped.
Any active state → idle or an explicit recoverable error state when an operation fails.
Prevent stale asynchronous events from moving the core into an incorrect state after a newer interaction has started.

10. Error and recovery flows
Condition	User-facing behavior	Recovery
Backend unreachable	Show connection warning	Retry request / reconnect
Invalid API key	Show service configuration error without exposing secret	Operator fixes backend environment
Provider rate limit	Explain temporary limit	Retry after delay
Provider timeout	Show retry option	Retry
Microphone denied	Explain permission issue	User changes browser permission or types
Recognition unsupported	Explain voice input limitation	Typed input
No matching voice	Keep text response	Select another available voice
Speech interrupted	Stop playback	User may replay
Conversation not found	Show unavailable conversation	Return to new conversation
11. Interaction rules
Never discard a draft merely because a voice or network operation failed.
Disable duplicate send actions while a request is being submitted, but allow a deliberate cancel/stop behavior if supported.
Clearly distinguish a request in progress from a completed response.
Do not start microphone capture without an explicit user action.
Do not auto-speak unexpectedly on initial page load.
Keep text as the authoritative response even when voice is enabled.
