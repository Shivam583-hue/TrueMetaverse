# Changelog

All notable changes to TrueMetaverse are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), grouped into **Added**, **Changed**, **Fixed**, **Removed**, and **Security**.

TrueMetaverse does not publish tagged releases.
The live deployment at [metaverse.nemportfolio.in](https://metaverse.nemportfolio.in) tracks `main`, so each section below is a dated milestone on `main` rather than a version number.
Sections are ordered newest first.

---

## 2026-07-30 - Observability foundations

Structured logging, request correlation, and process lifecycle handling.
Before this milestone the only diagnostic tooling was 19 scattered server-side `console` calls, and several routes reported infrastructure failures as client mistakes.

Merged in [#12](https://github.com/Shivam583-hue/TrueMetaverse/pull/12).

### Added

- `@repo/logger` workspace: a pino-based structured JSON logger with a `LOG_LEVEL` override, credential redaction for passwords, tokens, authorization headers, and cookies, and a synchronous stdout destination so a crashing process still flushes its final record.
- `@repo/lifecycle` workspace: ordered graceful shutdown with per-step and overall timeouts, plus `uncaughtException` and `unhandledRejection` handlers that log at fatal level and exit for the container runtime to restart.
- Request correlation across the whole request path: nginx generates an `X-Request-Id`, Express echoes it, and both services log it, so one identifier ties an nginx access line to an application log line to the response the user saw.
- Central Express error middleware with a typed `AppError`, mapping Zod failures, body-parser failures, and unknown throwables to correct status codes without leaking internal messages.
- JSON `404` handling for unmatched API routes, replacing Express's default HTML error page.
- One structured completion log per request carrying method, route template, status, duration, and user id, with `/healthz` excluded to keep the container health check from generating roughly 8,600 log lines a day.
- JSON access log format in nginx including request id, upstream timing, and status.
- Graceful WebSocket drain on shutdown: connected clients receive a `1001` close with a reason instead of an abrupt socket drop.
- `LOG_LEVEL` environment variable, wired through both Compose files and documented in `.env.example`.
- 37 new tests covering log redaction, level resolution, request id validation, route templating, error classification, and shutdown sequencing.

### Changed

- All server-side `console` calls replaced with the structured logger across the HTTP service, the WebSocket service, and the seed job.
- WebSocket connections now carry a child logger keyed by connection id, re-bound with user id and space id once a join succeeds.
- Per-connection socket logging dropped from info to debug, so normal traffic no longer floods the log at production level.
- The `web` Nginx image and both application images now build from the two new workspaces.

### Fixed

- Signup reported a database outage as `400 User already exists`, making an infrastructure failure indistinguishable from a taken username.
  Unique-constraint violations are now detected by Prisma error code and everything else returns a logged `500`.
- Room creation returned `400 Could not create space` with no logging for any failure that was not a room-code collision, hiding real errors behind a client-error status.
- `POST /user/woka` returned HTTP `400` with the body `Internal server error`, a status and message that contradicted each other.
- `POST /user/metadata` could not distinguish an unknown avatar id from a database failure; the unknown-avatar case now returns a `400 Unknown avatar` and genuine failures return a logged `500`.
- A silent `catch {}` in the LiveKit presenter release swallowed every failure without a trace.
- The PostgreSQL pool had no `error` listener, so an error on an idle client would take the whole process down.

### Removed

- `packages/db/index.ts`, a debug entry point exported as the package's main module that executed a query and printed **every user row** to stdout on import.

---

## 2026-07-30 - Arena control contrast

### Fixed

- Ghost buttons in the Arena were effectively invisible against dark map backgrounds.
  An initial community fix was merged in [#8](https://github.com/Shivam583-hue/TrueMetaverse/pull/8), reverted in [#9](https://github.com/Shivam583-hue/TrueMetaverse/pull/9) after it regressed other controls, and replaced by a narrower fix in [#10](https://github.com/Shivam583-hue/TrueMetaverse/pull/10) that removes only the offending transparent property.

Thanks to [@cell0901](https://github.com/cell0901) for the first external contributions to the project.

---

## 2026-07-29 - Contribution guide

### Added

- `CONTRIBUTING.md` covering local setup, architectural rules, testing expectations, and the pull-request process.

---

## 2026-07-28 - Presence lifecycle

Presence correctness work.
Rooms could accumulate avatars belonging to nobody, and a connection that died without a close frame stayed in the roster indefinitely.

Merged in [#6](https://github.com/Shivam583-hue/TrueMetaverse/pull/6).

### Added

- Ping/pong heartbeat that reaps connections which die without sending a close frame, with a configurable `WS_HEARTBEAT_INTERVAL_MS` interval.
- Session eviction so opening the same space a second time replaces the previous session instead of duplicating the avatar.
- Roster and session test coverage, including heartbeat sweeps, eviction, and ghost-user regression cases.

### Fixed

- Ghost users leaked into the room roster when a join completed after its socket had already closed; the join result is now discarded rather than inserted.
- HUD alert chips rendered in the default colour instead of the alert colour.

---

## 2026-07-27 - Authentication and transport hardening

A focused security pass over authentication, session handling, and the public routing path.

Merged in [#4](https://github.com/Shivam583-hue/TrueMetaverse/pull/4) and [#5](https://github.com/Shivam583-hue/TrueMetaverse/pull/5).

### Security

- The service now fails fast on a missing or weak `JWT_PASSWORD` under `NODE_ENV=production` instead of silently falling back to a public development signing key.
- Signin returns a single uniform failure for both unknown usernames and wrong passwords, and compares against a dummy hash on the unknown-user path so response timing does not reveal which accounts exist.
- scrypt comparison hardened against malformed stored hashes and made constant-time.
- Signup enforces a password policy covering length, commonness, and similarity to the username.
- Per-IP rate limiting on authentication endpoints and general API traffic, plus Helmet security headers.
- WebSocket sockets are now closed on failed join authentication rather than left open.
- Bulk metadata and room-code lookup now require authentication.
- The admin role claim was removed from tokens and session handling entirely.

### Fixed

- Caddy proxies the application at layer 4 and cannot add `X-Forwarded-For`, so every request reached Express with the same gateway address and a single client's failed logins could exhaust the shared rate-limit budget for everyone.
  Caddy now speaks PROXY protocol v2 to Nginx, which recovers the original client address.

### Added

- Integration coverage for every hardening change above, including WebSocket authentication rejection paths.

---

## 2026-07-22 - Code of conduct

### Added

- `CODE_OF_CONDUCT.md`.

---

## 2026-07-16 - Security policy

### Changed

- Revised the vulnerability reporting guidance to route reports privately rather than through public GitHub issues.

---

## 2026-07-15 - First production deployment

The project went live on a self-hosted Rocky Linux VPS running the application plane, the media plane, PostgreSQL, and TLS termination on one host.

### Added

- Production deployment on a single VPS with Caddy handling TLS and SNI routing for the app, LiveKit, and TURN domains.
- Architecture documentation, an engineering scorecard, and a demo video in the README.

### Fixed

- Several defects that only reproduced against the production configuration.

### Removed

- Legacy test suites left over from the pre-v2 API surface.

---

## 2026-07-14 - Classroom, whiteboard, and containers

### Added

- Classroom map with a synchronized Excalidraw whiteboard, broadcast to the room under creator-only edit permissions with server-side payload limits.
- Enchanted Forest Hide & Seek map and the first implementation of the game mode.
- Mobile support: a pointer-friendly virtual joystick, touch controls, and zoom controls.
- Docker packaging with a multi-stage build producing separate HTTP, WebSocket, and Nginx images, and Nginx same-origin routing that serves the SPA, proxies `/api/*`, and upgrades `/socket`.
- A reusable confirmation dialog component.

### Changed

- Migrated the UI to Tailwind CSS.

### Fixed

- Dialog close buttons stole focus on mount; the close button is now only mounted on first load.

---

## 2026-07-13 - Realtime media and social features

The media stack was rebuilt during this milestone.
A peer-to-peer WebRTC mesh was replaced with a LiveKit SFU after the mesh proved unable to scale past a handful of participants.

### Added

- Room-scoped realtime chat with trimming, length limits, and per-user rate limiting.
- Virtual Office map.
- LiveKit SFU for audio and video, with TURN relay for restrictive networks.
- Screen sharing and a presentation room with lectern permissions.
- Proximity scoping so calls are limited to the room you are standing in.

### Changed

- Replaced the WebRTC mesh with LiveKit, rewriting the media hook and retiring the bespoke peer-connection test suite.
- Remote player positions now update every frame instead of on an interval.

### Fixed

- Peer audio never played in the video dock.
- Room join codes are distributed more robustly.

---

## 2026-07-12 - The v2 pivot

The project's scope changed materially here.
An admin-oriented CRUD product was replaced with a study-and-collaboration product, and the web client was built for the first time.

### Added

- Web application scaffolded with Vite, React, and React Router, including authentication.
- Dashboard with a spaces grid, create-from-template modal, and avatar picker.
- Arena built on Phaser with a tile scene, WebSocket client, optimistic movement, and creator edit mode.
- Study sessions with persistent timers and a ranking board.
- Short human-friendly room codes, join-by-code, and official spaces.
- Server-side bounds validation on WebSocket movement.
- Seed script using open-source assets, later replaced with local character avatars and the official `LIBRARY` room.

### Removed

- The admin panel, admin middleware, and the element and map administration APIs, roughly 250 lines of route code, in favour of template-only room creation.

### Fixed

- Foreign key violation when deleting a space that still had elements attached.
- The Phaser arena chunk is now lazy loaded rather than shipped in the initial bundle.

---

## 2026-07-11 - Typed protocol and catalogue APIs

### Added

- Shared TypeScript message contracts for the WebSocket protocol, so the client and server compile against one definition.
- List, update, and delete endpoints for maps and avatars.
- Test coverage for the new endpoints.

### Fixed

- A missing `await` on an element update silently dropped the write.
- Protocol gaps: identity is now present on all events, positions are included in `space-joined`, and usernames are returned from bulk metadata.

---

## 2026-07-05 - Initial implementation

### Added

- Prisma schema and PostgreSQL persistence for users, spaces, avatars, maps, and elements.
- Authentication with signup, signin, and JWT sessions.
- Space, user, and admin REST APIs with request middleware.
- WebSocket server with join, movement, and presence broadcasting.
- The first automated test suite, growing from 25 to 30 passing scenarios over the first two days.

---

## Test coverage over time

Automated scenario counts at each milestone, as recorded in the README at the time.

| Milestone  | Bun unit and regression | Jest integration |   Total |
| ---------- | ----------------------: | ---------------: | ------: |
| 2026-07-06 |                       - |                - |      30 |
| 2026-07-27 |                      31 |               59 |      90 |
| 2026-07-28 |                      45 |               63 |     108 |
| 2026-07-30 |                      82 |               63 | **145** |

The 2026-07-06 figure predates the split into a fast Bun suite and a cross-service Jest suite, so it is reported as a single total.
