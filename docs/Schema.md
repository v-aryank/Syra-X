
SYRA X — Data Schema and Security Rules (Schema)
Document status: Baseline logical schema
Version: 1.0
Last updated: 2026-11-06

1. Purpose
Define the initial logical data model for conversations and messages, plus the rules that protect conversation isolation and provider data. This is a logical baseline; exact SQL types and ORM mappings are selected during implementation.

2. Data principles
A conversation contains an ordered sequence of messages.
Every message belongs to exactly one conversation.
Conversation identifiers are not authorization credentials.
A client must not be able to read or modify another user's/session's conversation by guessing an ID.
Provider secrets are configuration, not database records.
Grounding sources are associated with the assistant message that returned them.
Store only data needed for the approved product behavior.
3. Entities
3.1 Conversation
Field	Logical type	Required	Description
id	UUID/string ID	Yes	Primary identifier
owner_key	opaque string	Yes	Server-controlled owner/session scope
title	string	Yes	Display title; may begin as “New conversation”
created_at	timestamp	Yes	Creation time in UTC
updated_at	timestamp	Yes	Last activity time in UTC
3.2 Message
Field	Logical type	Required	Description
id	UUID/string ID	Yes	Primary identifier
conversation_id	UUID/string ID	Yes	Foreign key to conversation
role	enum	Yes	user or assistant for persisted chat messages
content	text	Yes	Plain-text message content
created_at	timestamp	Yes	Creation time in UTC
model	string/null	No	Model identifier for assistant response
grounded	boolean	Yes	Whether grounding was confirmed for this response
metadata_json	JSON/null	No	Limited non-secret provider/usage metadata
3.3 Source
Field	Logical type	Required	Description
id	UUID/string ID	Yes	Primary identifier
message_id	UUID/string ID	Yes	Assistant message that returned the source
title	string/null	No	Source title when available
url	string	Yes	Source URL
domain	string/null	No	Display domain when available
created_at	timestamp	Yes	Record creation time
A source belongs to an assistant message. The backend should validate URL schemes and reject unsafe or unsupported schemes such as javascript:.

4. Relationships
Conversation 1 ──────── * Message
Message     1 ──────── * Source
Deleting a conversation should delete its messages and associated sources transactionally, if deletion is enabled.
Deleting an assistant message should not leave orphaned sources.
Use database foreign keys and appropriate indexes.
5. Constraints and indexes
Recommended constraints:

Conversation.id primary key.
Message.id primary key.
Source.id primary key.
Message.conversation_id foreign key with cascade behavior defined.
Source.message_id foreign key with cascade behavior defined.
Message.role limited to supported roles.
Message.content non-empty after trimming, with an application-level maximum length.
Source.url non-empty and validated by the application.
Index messages by (conversation_id, created_at).
Index conversations by (owner_key, updated_at).
6. Conversation ownership and isolation
The server must derive or validate owner_key from a trusted session/authentication mechanism. Do not accept an arbitrary owner_key from the request body.

For an initial private/single-user deployment, choose and document a safe ownership model before enabling remote access. Possible approaches include a server-managed authenticated user, a signed session cookie, or a deployment restricted to one trusted user. A bare conversation UUID is not sufficient access control.

Every read, update, and delete query must scope the conversation by both its identifier and the current owner context.

7. Message lifecycle
Validate incoming user message.
Verify conversation belongs to current owner context, or create a conversation.
Persist user message.
Build provider context from messages in that conversation only.
Request provider response.
Persist assistant response and any valid grounding sources.
Return a normalized API response.
Define transaction boundaries carefully. If provider generation fails after the user message is stored, preserve the user message and record a safe failure state or allow retry without duplicating it.

8. Retention and deletion
The first release must define whether conversation deletion is available and how long conversations are retained. Until a retention policy is approved:

do not silently promise indefinite retention;
do not add background deletion without a documented policy;
do not store unrelated personal data;
document where the database is stored and how backups are handled.
9. Data not to store
Do not store:

Gemini API keys or other provider secrets;
microphone audio recordings (browser speech recognition should return text only for this design);
browser permission tokens;
unnecessary device fingerprints;
full raw provider objects when only normalized response and grounding fields are needed;
arbitrary HTML intended for direct rendering.
10. Migration guidance
Keep schema changes in version-controlled migrations when a migration framework is selected.
Test migrations from an empty database and from the previous schema version.
Back up production data before destructive migrations.
Use UTC timestamps in storage and convert to local time in the UI.
