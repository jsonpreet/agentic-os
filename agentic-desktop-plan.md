# Agentic Desktop — Full Product and Technical Plan

## 1. Product Vision

Build a paid desktop application that feels like an expandable operating system for developers and designers.

The application combines:

- Multiple workspaces and virtual desktops.
- A custom top HUD and floating prompt dock.
- Named AI agents running through installed CLIs.
- Developer apps, widgets, and an extension system.
- Typed and spoken instructions.
- Agent-specific spoken responses.
- Encrypted cloud progress and live cross-device control.
- Subscription licensing with registered-device limits.

Agents execute on a user-owned computer. Authorized devices can view their progress and control them remotely.

### Example

A user opens three agents on a Mac:

- **Tim — Codex**
- **Jade — Gemini**
- **Stark — Claude**

They say:

> “Hey Tim, implement login.”

Tim receives the instruction in its existing session.

Later, from a phone, the user watches Tim’s live terminal, answers an approval request, and says:

> “Hey Jade, review Tim’s changes.”

The execution remains on the Mac. The phone acts as a viewing and control client.

---

## 2. Scope and Product Defaults

### Confirmed requirements

- macOS is the first execution platform.
- The desktop environment lives inside the application.
- Workspaces contain multiple repositories.
- Each workspace supports multiple virtual desktops.
- Users select agent providers.
- New agents receive unique, editable names.
- Repository tasks use isolated Git worktrees.
- Built-in apps support coding and design workflows.
- Third-party apps and widgets use an SDK.
- Speech is sent automatically when recording stops.
- Instructions to busy agents queue by default.
- Addressed agents can speak their responses.
- STT and TTS independently support local and API providers.
- Cloud stores encrypted progress and terminal history.
- Other devices can view and control live sessions.
- Licensing uses subscriptions and registered-device limits.
- Encrypted-history recovery uses a personal recovery key.

### Initial release boundaries

- Prioritize web/full-stack development and UI design.
- Support other developers through terminals, files, Git, browser, and custom commands.
- Deliver responsive web access before native mobile apps.
- Add Windows execution support after the macOS host is stable.
- Defer automatic multi-agent task decomposition.
- Defer a public app marketplace.
- Defer cloud-hosted execution and automatic process migration.
- Keep repository synchronization outside the initial release.

---

## 3. Technical Stack

| Component | Technology |
|---|---|
| Desktop application | Tauri (Rust) + React |
| Shared desktop/web UI | React + TypeScript |
| Frontend tooling | Vite |
| Local execution engine | Node.js + TypeScript |
| Interactive terminals | xterm.js + node-pty |
| Code editor | Monaco Editor |
| Local structured storage | SQLite |
| Repositories and attachments | Local filesystem |
| Git isolation | Git worktrees |
| Credentials | macOS Keychain; Windows credential store when supported |
| Native macOS speech | Swift helper behind provider interfaces |
| Cloud API | Node.js + TypeScript |
| Cloud metadata | PostgreSQL |
| Encrypted history storage | S3-compatible object storage |
| Live terminal relay | WebSockets with application-level end-to-end encryption |
| Billing | Stripe Billing |
| Native mobile application | Later implementation against the shared protocol |

Use a monorepo containing desktop, web, local engine, cloud services, shared contracts, UI components, and SDK packages.

Desktop and web reuse interface code. They communicate with the same execution-engine contracts through different transports.

---

## 4. System Architecture

### Local execution host

The host owns:

- CLI discovery and execution.
- Terminal processes.
- Git repositories and worktrees.
- Browser sessions and browser automation.
- Local app data.
- Provider credentials.
- Speech processing integrations.
- Session event generation.
- Encryption before cloud upload.

Closing a viewer does not stop agents. The host service must remain running.

### Cloud services

The cloud provides:

- Account authentication.
- Device registration and revocation.
- Subscription entitlements.
- Device presence.
- Encrypted live-message relay.
- Encrypted progress storage.
- Generic notification delivery.

The cloud does not need plaintext terminal content or repository files to provide these services.

### Viewer clients

Desktop, web, and future mobile clients provide:

- Workspace and session navigation.
- Live terminal viewing.
- Agent messaging.
- Approval responses.
- Stop controls.
- Saved-history viewing.
- Device and subscription management.

Remote clients must show the execution device prominently.

### Process boundaries

Separate:

- Tauri webview (React UI).
- Rust desktop shell (windowing, IPC, engine lifecycle).
- Node.js local execution engine (sidecar subprocess).
- Terminal management.
- Browser automation.
- Speech processing.
- Third-party app renderers.

Use Tauri capability permissions and a narrow `agentic_invoke` command surface. The webview receives typed API access only; the Node engine runs as a separate subprocess with Unix-socket JSON-RPC.

---

## 5. Desktop Shell

### Top HUD

Include:

- Application and contextual menus.
- Workspace selector.
- Desktop switcher.
- Running-agent count.
- Notifications.
- Global command search.
- Device connection state.
- Settings.

### Floating dock

Include:

- Expandable prompt input.
- Microphone.
- File attachments.
- Repository selector.
- Agent-provider selector.
- App launcher.
- Pinned apps.
- Running and minimized agents.

The microphone controls speech input.

### Internal windows

Support:

- Open, focus, move, resize, minimize, and close.
- Snapping and keyboard navigation.
- Moving windows between desktops.
- Persistent layouts.
- Agent identity and state in terminal titles.

Closing a running agent window offers:

- Keep running in the background.
- Stop the agent.

Minimizing and switching desktops never stop processes.

### Visual direction

Use a restrained macOS-inspired design with:

- Dark default appearance.
- Translucent HUD and dock.
- Clear focus and hierarchy.
- Accessible contrast.
- Keyboard operation.
- Reduced-motion support.

---

## 6. Workspaces and Virtual Desktops

### Workspaces

A workspace is a persistent project collection containing:

- Name and icon.
- Repositories.
- Desktops.
- Agent sessions.
- Notes.
- Boards.
- App data.
- Browser-profile association.

Workspaces appear as volume-like collections. They are not mounted disk volumes.

### Desktops

A desktop is a window and widget arrangement within a workspace.

Examples:

- Build.
- Design.
- Research.
- Review.

Users can create, rename, reorder, and switch desktops.

Agents remain addressable across desktops within the active workspace.

### Cross-device layouts

Sync the workspace and session catalog.

Keep window geometry device-specific so phone layouts do not overwrite desktop layouts. Each client restores its own arrangement.

---

## 7. CLI Discovery and Integration

### Onboarding discovery

During first launch:

- Inspect the login-shell PATH.
- Check standard CLI installation locations.
- Detect supported executables and versions.
- Show integration capabilities.
- Offer Rescan and Add CLI Manually.

Do not automatically install or authenticate tools.

### Initial adapters

Target:

- Codex.
- Claude Code.
- Gemini CLI.
- Cursor CLI.
- Custom CLI launchers.

Validate each tool’s current interface during implementation.

### Adapter capabilities

Each adapter declares support for:

- Discovery and version checks.
- Launch configuration.
- Initial prompt delivery.
- Follow-up input.
- Attachments.
- Readiness and approval events.
- Structured assistant responses.
- Session resumption.
- Browser tools.
- Usage retrieval.

Unsupported capabilities remain visibly unavailable.

Use executable-plus-arguments spawning. Do not construct shell commands by interpolating prompt text.

Existing CLI authentication remains under the CLI’s control.

---

## 8. Named Agents and Prompt Routing

### Identity

Every agent session has:

- Stable session ID.
- Unique workspace-scoped display name.
- Provider.
- Execution device.
- Workspace and desktop.
- Task and repository association.
- Optional voice assignment.

Generate a random name on creation and allow renaming.

### Routing order

1. Explicit agent name: route to that session.
2. Recognized app command: invoke the app command service.
3. Other task: launch a new agent with the selected provider.

Examples:

| Request | Result |
|---|---|
| “Hey Tim, fix this error” | Send to Tim |
| “Hey Jade, what’s your status?” | Send to Jade |
| “Open example.com in the browser” | Open Browser and navigate |
| “Switch to Design desktop” | Switch desktop |
| “Build a landing page” | Start a new named agent |

Unknown or ambiguous names show a target picker and preserve the draft.

Cross-workspace targets require explicit workspace selection.

### Busy agents

- Queue follow-up instructions.
- Show queue state.
- Allow editing and cancellation.
- Deliver in order when safe.
- Provide an explicit interrupt action.

Never type task instructions into authentication or permission prompts.

If readiness cannot be detected reliably, require explicit delivery rather than guessing.

### Reliable state

Track process lifecycle independently from inferred task progress.

Only show “awaiting approval,” “working,” or “idle” when the adapter supplies dependable evidence.

A process exit does not automatically mean the task succeeded.

---

## 9. Speech and Agent Voices

### Speech-to-text

Support click-to-record and push-to-talk.

When recording stops:

1. Finish transcription.
2. Display the transcript.
3. Resolve the target.
4. Send automatically.
5. Show delivery or queue state.

An empty transcript does nothing. Ambiguous targets require clarification.

### Text-to-speech

Each agent has an optional persistent voice.

Default behavior:

- Speak replies to explicitly addressed instructions.
- Keep other agents silent.
- Queue overlapping speech.
- Pause playback during microphone recording.
- Exclude code blocks, tool logs, and terminal control sequences.
- Provide stop, replay, volume, and global mute.

Use structured assistant-response events. Unsupported adapters offer manual read-aloud.

Speech plays on the client that sent the instruction, not simultaneously on every connected device.

### Provider settings

Configure STT and TTS independently:

- Local engine or API.
- Provider endpoint.
- Model.
- Credentials.
- Language.
- Microphone and output device.
- Voice, speed, and volume.
- Per-agent voice.
- Connection and voice preview.

Support adapters and compatible custom endpoints; arbitrary APIs require integration work.

Never silently switch local processing to cloud processing. Do not retain microphone recordings by default.

---

## 10. Browser App and Agent Access

### Browser features

Provide:

- Tabs.
- Navigation.
- Dedicated profiles.
- Bookmarks.
- Downloads.
- Screenshots.
- Developer tools.
- Local development previews.

Users sign into websites inside app-managed profiles.

### Agent browser tools

Expose:

- Open and select tabs.
- Navigate URLs.
- Read page content.
- Inspect interactive elements.
- Click, type, scroll, and select.
- Submit forms.
- Upload granted files.
- Inspect downloads.
- Capture screenshots.
- Inspect console and network activity.

Use a shared local browser service, exposed through MCP where the agent supports it.

### Control ownership

- Show the controlling agent.
- Permit one input controller per tab.
- Provide Take Over and Stop.
- Preserve visible action history.
- Scope access to granted profiles and files.

### Remote browser visibility

Remote clients receive an encrypted view of the managed browser through the host, rather than embedding arbitrary websites.

Implement a host-rendered frame stream with input forwarding for initial remote viewing and control. Keep browser automation APIs separate from the visual stream.

If the host is offline, show saved browser metadata and clearly indicate that live interaction is unavailable.

---

## 11. GitHub and Repository Workflow

Support:

- GitHub sign-in.
- Repository browsing and cloning.
- Existing checkout attachment.
- Default repository selection.
- Repository-free tasks.

### Task isolation

Create a dedicated branch and worktree for each new repository task.

Default the base to the selected checkout’s committed HEAD. Preserve uncommitted changes in the original checkout.

If no initial commit exists, require repository initialization before creating a worktree.

### Source Control

Provide:

- Diffs.
- Stage and unstage.
- Commits.
- Push.
- Pull-request creation.
- GitHub links.

Publishing is explicit. Do not automatically merge.

Retain worktrees until removed by the user. Confirm before discarding uncommitted changes.

Repository-free tasks use workspace-owned directories.

---

## 12. Starting App Suite

All 16 built-in apps run strictly as in-app windows inside the Tauri 2 desktop shell on the active virtual desktop (managed by `WindowManager.tsx`), communicating with the local engine over JSON-RPC socket/HTTP bridge. They do not launch external macOS applications (Safari, Finder, etc.).

| App | Initial capabilities | Implementation Status | Key Components & Services |
|---|---|---|---|
| Agent Terminal | Named agents, shells, queues, history | Complete | `AgentTerminalWindow.tsx`, `LocalEngine`, xterm.js |
| Browser | Browsing, developer tools, agent control | Complete | `BrowserAppWindow.tsx`, `BrowserToolService`, iframe sandbox |
| Code Editor | Files, syntax highlighting, search, diagnostics, formatting | Complete | `CodeEditorAppWindow.tsx`, Monaco Editor, FileService |
| Files | Navigation, previews, attachments | Complete | `FilesAppWindow.tsx`, `FileService` |
| Source Control | Worktrees, diffs, commits, PRs | Complete | `SourceControlAppWindow.tsx`, `GitService`, `GitHubService` |
| Preview & Dev Servers | Commands, logs, local URLs, process controls | Complete | `DevServersAppWindow.tsx`, `DevServerService` |
| Design & Assets | Images, SVGs, references, colors, typography | Complete | `DesignAssetsAppWindow.tsx`, `DesignAssetsService` |
| API Client | Requests, authentication, environments, collections | Complete | `ApiClientAppWindow.tsx`, `HttpClientService` |
| Database Explorer | PostgreSQL and SQLite, schema, queries, results | Complete | `DatabaseExplorerAppWindow.tsx`, `DatabaseExplorerService` |
| Kanban | Boards, task cards, linked sessions | Complete | `KanbanAppWindow.tsx`, `KanbanService` |
| Notes | Markdown, autosave, specifications | Complete | `NotesAppWindow.tsx`, `NotesService` |
| Agent Usage | Supported limits, reset times, freshness | Complete | `AgentUsageAppWindow.tsx`, `UsageSettingsPanel.tsx`, `usage/` parsers |
| Notifications | Completion, failures, approvals | Complete | `NotificationsAppWindow.tsx`, `NotificationService` |
| Activity & Logs | Searchable task and app events | Complete | `ActivityLogsAppWindow.tsx`, `ActivityService`, `activity_events` DB |
| Devices & License | Pairing, revocation, subscription | Complete | `DevicesLicenseAppWindow.tsx`, `AccountService` |
| App Library & Settings | Extensions, providers, permissions | Complete | `AppLibraryAppWindow.tsx`, `SettingsModal.tsx`, `ExtensionService` |

Prioritize JavaScript, TypeScript, HTML, CSS, JSON, and Markdown in the editor. Provide configurable language-server integration for other languages.

Design & Assets is not initially a full collaborative canvas editor.

Kanban cards can launch agents, but completion remains a user decision.

---

## 13. Usage, Notifications, and Widgets

### Agent usage

Display per supported provider:

- Account.
- Used and remaining allowance.
- Reset time and countdown.
- Active sessions.
- Last refresh.
- Source.

Unavailable information displays as Unavailable. Estimates remain clearly labeled.

Do not infer subscription balance from terminal activity.

### Notifications

Provide a persistent inbox with links to tasks.

Support:

- Completion.
- Failure.
- Approval requests.
- Dev-server failure.
- Supported usage thresholds.
- Device disconnection.

Deduplicate repeated events.

Push notifications contain generic text by default; detailed content is decrypted inside the client.

### Widgets

Initial widgets:

- Agent usage.
- Running agents.
- Attention requests.
- Kanban tasks.
- Quick note.
- Repository status.
- Dev-server status.
- Recent files.
- Notifications.

Widgets support add, remove, resize, rearrange, and layout restoration.

---

## 14. Cloud Continuity and Remote Control

### Saved progress

Synchronize encrypted:

- Workspace and session catalog.
- Agent names and provider associations.
- Terminal checkpoints and output history.
- Task activity.
- Queue state.
- Notes and boards.
- Relevant app-state metadata.

Repository files, browser cookies, provider credentials, and attachment contents remain on the host by default.

Terminal output can contain source code or secrets; treat it as sensitive content.

Offer local-only sessions that do not upload content or permit remote viewing.

### Live connections

The host opens an outbound connection to the relay.

Authorized viewers subscribe to encrypted session streams. Do not require public inbound ports on the user’s computer.

Use sequence numbers, replay cursors, and terminal checkpoints to reconnect without duplicating or losing displayed output.

### Remote input

Allow multiple viewers and one active input controller per terminal.

Commands carry:

- Unique command ID.
- Target session.
- Sending device.
- Expected session generation.
- Expiration.
- Acknowledgement state.

The host checks authorization and deduplicates commands before execution.

Approval responses reference a specific pending approval.

Do not automatically replay stale or uncertain commands after reconnection. Show unresolved delivery states.

### Offline behavior

- Show last synchronized history with timestamps.
- Mark the execution host offline.
- Disable live controls.
- Preserve drafts.
- Do not imply that cloud storage keeps the process running.

Host restart marks lost processes Interrupted. Resume only through supported CLI mechanisms.

---

## 15. Encryption, Pairing, and Recovery

### Data classification

Our service can read:

- Account identity.
- Device registration and public keys.
- Subscription entitlement.
- Connection presence.
- Storage accounting and operational metadata.

Our service stores only ciphertext for project progress and terminal content.

Do not claim that encryption hides connection timing, payload size, or account activity metadata.

### Key management

Use a vetted encryption library and reviewed protocol design.

- Generate keys on trusted clients.
- Store private device keys in OS-protected storage.
- Encrypt content before upload.
- Authenticate live commands and bind them to their target.
- Never log plaintext payloads or secret keys server-side.

### Pairing

New devices require:

- Account authentication.
- License-slot availability.
- Approval from a trusted device or recovery-key unlock.

Login alone does not grant decryption access.

### Recovery

Generate a personal recovery key and require the user to acknowledge saving it.

Without a trusted device or recovery key, encrypted history cannot be recovered by support.

### Revocation

Revocation:

- Disconnects the device.
- Prevents future relay and storage access.
- Rotates access to future encrypted content.

It cannot erase plaintext or keys already copied to a revoked device.

---

## 16. Subscription and Device Licensing

### Model

Use monthly and annual subscriptions.

Each plan configures:

- Registered-device limit.
- Cloud-history retention.
- Encrypted-storage allowance.
- Feature entitlements.

Prices and production allowances are commercial launch settings, not hardcoded application behavior.

### Device counting

- Each paired computer or phone consumes a slot.
- A browser paired through an existing desktop companion shares that device’s slot.
- A standalone browser registration consumes its own slot.
- Do not fingerprint browsers to infer physical identity.

Users can revoke old registrations to free slots.

### Enforcement

Check entitlements at registration and cloud connection.

Use verified billing webhooks with idempotent processing and reconciliation.

Cache a signed, expiring entitlement locally for temporary offline operation. Default the offline lease to seven days, capped by known entitlement expiry.

### Expiration behavior

- Never delete local work.
- Never abruptly terminate an active agent because a license expires.
- Keep local history readable and exportable.
- Restrict new paid sessions and cloud controls after entitlement expiry.
- Let existing local sessions finish and remain stoppable.

Cloud-content retention and deletion dates must be visible to the user and driven by the plan’s configured policy.

Payment-card details remain with the payment processor.

---

## 17. App and Widget SDK

### Manifest

Include:

- App ID, name, and version.
- SDK compatibility.
- Icon.
- Window entrypoint.
- Optional widget entrypoint.
- Requested permissions.

### SDK capabilities

Provide:

- Workspace context.
- App-scoped storage.
- Window and widget registration.
- Commands.
- Notifications.
- Explicit task-launch requests.
- Granted file access.
- Session events.

Third-party apps run in isolated renderers without unrestricted host access.

Install local bundles through App Library. Show permissions and reject incompatible packages.

Ship an example app demonstrating storage, a widget, and agent-task launching.

Sync extension identity and configuration where appropriate, but require installation and permission approval on each device.

---

## 18. Shared Interfaces

Define versioned contracts for:

- AgentAdapter.
- UsageAdapter.
- STTProvider.
- TTSProvider.
- BrowserToolService.
- AppManifest and AppSDK.
- Workspace and Desktop.
- AgentSession and Task.
- SessionEvent and RemoteCommand.
- DeviceRegistration and Entitlement.
- EncryptedHistoryChunk.

The execution host is authoritative for running sessions and command ordering.

Shared workspace edits go through the online host initially. Remote offline editing is limited to local drafts, avoiding a separate conflict-resolution system in the first release.

---

## 19. Delivery Milestones

### Milestone 1 — Local desktop foundation [Status: Verified]

Deliver:

- HUD, dock, windows.
- Workspaces and desktops.
- CLI discovery.
- Named agents.
- Worktrees.
- Typed routing and queues.
- Local persistence.

Acceptance: run two agents in isolated worktrees and address them from different desktops.
- **Verification**: Verified in `packages/local-engine/tests/integration.test.ts` and `packages/desktop/tests/workspace-bootstrap.test.ts`.

### Milestone 2 — Browser and speech [Status: Verified]

Deliver:

- Browser app and tools.
- App-command routing.
- STT/TTS providers.
- Per-agent voices.
- Playback queue.

Acceptance: dictate a task, observe browser interaction, and hear the addressed agent’s response.
- **Verification**: Verified in `packages/local-engine/tests/m2-acceptance.test.ts` and `packages/desktop/tests/m2-acceptance.test.ts`.

### Milestone 3 — Developer workflows [Status: Verified]

Deliver:

- Editor, Files, GitHub, Source Control.
- Dev Servers.
- Notes, Kanban, Design & Assets.
- API Client and Database Explorer.

Acceptance: complete implementation, browser verification, review, and PR creation.
- **Verification**: Verified in `packages/local-engine/tests/m3-acceptance.test.ts` and `packages/desktop/tests/m3-acceptance.test.ts`.

### Milestone 4 — Cloud and licensing [Status: Verified]

Deliver:

- Accounts and subscriptions.
- Device pairing and limits.
- Encryption and recovery.
- Saved progress.
- Live terminal viewing and control.
- Responsive web client.
- Remote browser view.

Acceptance: control a Mac-hosted agent from another device and inspect encrypted saved history after disconnecting the host.
- **Verification**: Verified in `packages/local-engine/tests/m4-acceptance.test.ts` and `packages/desktop/tests/m4-acceptance.test.ts`.

### Milestone 5 — Expansion and release [Status: Verified]

Deliver:

- Usage integrations (Claude, OpenAI, Codex, OpenRouter, Copilot).
- Notifications and widgets (9 desktop widgets with drag/drop/resize).
- SDK and example app (`@agentic/app-sdk`, example extension).
- Local extension installation (`ExtensionService`).
- Activity & Audit logs system (`ActivityService`, `activity_events` DB, `ActivityLogsAppWindow.tsx`).
- Production macOS release bundling (`tauri build` producing `Agentic Desktop.app` and `Agentic Desktop_0.1.0_aarch64.dmg`).
- Windows viewer web packaging.

Acceptance: full test suite passes (127/127 tests), production macOS .dmg and .app bundle created and verified.
- **Verification**: Verified in `packages/local-engine/tests/m5-acceptance.test.ts`, `packages/desktop/tests/m5-acceptance.test.ts`, and `packages/local-engine/tests/activity-service.test.ts`.

Follow with Windows execution support and native mobile clients.

---

## 20. Verification and Release Criteria

### Local agent tests

- Finder-launched CLI discovery.
- Multiline prompts and file paths.
- Correct named routing.
- Safe busy-agent queues.
- No injection into approval prompts.
- Worktree isolation.
- Reliable interrupted-session recovery.

### Browser and speech tests

- Navigation, forms, uploads, downloads.
- User takeover.
- Concurrent-control exclusion.
- Dictation denial and failure.
- Ambiguous names.
- No overlapping speech.
- No silent cloud fallback.

### Remote tests

- Live output ordering.
- Checkpoint replay.
- Reconnection without duplicate commands.
- Stale approval rejection.
- Host sleep and restart.
- Multiple viewers.
- Browser-stream control ownership.
- Local-only sessions remaining local.

### Encryption and license tests

- Cloud storage contains no plaintext progress.
- Pairing requires trusted approval or recovery.
- Revoked devices lose future access.
- Lost-key behavior is explicit.
- Device registration races respect limits.
- Billing event duplication is safe.
- Offline entitlement expiration preserves work.

### Release checks

- Database migrations preserve user data.
- Credential and payload logging is disabled.
- Signed builds run on supported Macs.
- Operational metrics exclude project content.
- Backups contain ciphertext for encrypted content.
- Users can export local data and delete cloud history.

---

## 21. Future Categories

Expand through app collections:

- **Mobile development:** simulators, devices, build logs.
- **Game development:** engines, assets, profiling.
- **Advanced design:** canvases, components, prototypes.
- **Video editing:** media library, timeline, transcription, rendering.
- **Marketing:** campaigns, publishing, analytics, brand assets.

All categories reuse named agents, workspaces, browser access, speech, widgets, notifications, and licensed cross-device continuity.
