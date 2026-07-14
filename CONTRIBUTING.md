# Contributing to TrueMetaverse

Thank you for helping improve TrueMetaverse. Contributions of all sizes are welcome: bug fixes, tests, documentation, accessibility improvements, performance work, new maps, and carefully scoped features.

This guide explains how to propose a change, run the project, respect its architectural boundaries, and prepare a pull request that is easy to review.

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Before you begin](#before-you-begin)
- [Repository structure](#repository-structure)
- [Development setup](#development-setup)
- [Making a change](#making-a-change)
- [Engineering guidelines](#engineering-guidelines)
- [Database changes](#database-changes)
- [Maps and media assets](#maps-and-media-assets)
- [Testing](#testing)
- [Commit and pull-request guidelines](#commit-and-pull-request-guidelines)
- [Pull-request checklist](#pull-request-checklist)
- [Reporting security issues](#reporting-security-issues)
- [License](#license)

## Ways to contribute

- Reproduce and fix a reported bug.
- Add regression coverage for an existing behavior.
- Improve keyboard, touch, responsive, or assistive-technology support.
- Reduce frontend bundle size or realtime-server resource usage.
- Improve map collision data without breaking spawn connectivity.
- Clarify documentation, deployment instructions, or error messages.
- Propose a focused feature that fits the shared-space experience.

For a substantial feature, protocol change, database redesign, or new infrastructure dependency, open an issue before implementation. Early agreement on scope prevents contributors from spending time on a direction the project cannot merge.

## Before you begin

1. Search existing issues and pull requests for related work.
2. For a bug, include exact reproduction steps, expected behavior, actual behavior, browser or operating system, and relevant logs.
3. For a feature, explain the user problem before proposing an implementation.
4. Keep unrelated changes in separate pull requests.

Be respectful and constructive in every project space. Critique ideas and code, not people. Harassment, discrimination, personal attacks, or disclosure of another person's private information are not acceptable.

## Repository structure

```text
TrueMetaverse/
├── compose.yaml                 # Complete local stack
├── compose.production.yaml      # Production application stack
├── deploy/                      # Caddy, LiveKit, Redis, and backups
├── metaverse/
│   ├── apps/
│   │   ├── web/                 # React, Phaser, Vite, and UI
│   │   ├── http/                # Express HTTP API
│   │   └── ws/                  # Realtime and game authority
│   └── packages/
│       ├── db/                  # Prisma schema, migrations, and seed
│       ├── types/               # Shared application protocol types
│       └── ui/                  # Shared UI package
└── tests/                       # Jest cross-service integration tests
```

## Development setup

### Complete Docker environment

The recommended setup runs the same service boundaries used in production:

```bash
git clone https://github.com/Shivam583-hue/TrueMetaverse.git
cd TrueMetaverse
cp .env.example .env
make docker-config
make docker-up
```

Open <http://localhost:5173>. Follow service output with:

```bash
make docker-logs
```

Stop the stack without deleting PostgreSQL data:

```bash
make docker-down
```

### Host development with Vite hot reload

This workflow runs only PostgreSQL and LiveKit in containers:

```bash
make docker-down
make setup
docker compose -f metaverse/livekit/docker-compose.yml up -d
make run
```

See the main [README](README.md#local-development-setup) for prerequisites, ports, and environment-variable details.

## Making a change

1. Fork the repository and create a branch from the latest `main`.
2. Use a focused branch name such as `fix/empty-player-label`, `feat/map-selector`, or `docs/docker-setup`.
3. Make the smallest coherent change that solves the stated problem.
4. Add or update tests for behavior changes.
5. Run the relevant checks locally.
6. Review the final diff for secrets, generated files, unrelated formatting, and debug output.
7. Open a pull request with a clear description and verification steps.

```bash
git switch main
git pull --ff-only
git switch -c fix/short-description
```

Do not commit `.env`, `.env.production`, database dumps, private keys, access tokens, or production credentials.

## Engineering guidelines

### TypeScript and formatting

- Prefer explicit domain types at service and protocol boundaries.
- Reuse contracts from `metaverse/packages/types` instead of defining incompatible client and server shapes.
- Avoid `any` in production code unless an external boundary genuinely cannot be typed.
- Follow the existing React component, hook, and Phaser system organization.
- Run Prettier rather than manually aligning formatting.
- Keep comments focused on intent, invariants, and non-obvious tradeoffs.

### Realtime behavior

- Treat the WebSocket server as authoritative for movement, collision, room membership, visibility, and game outcomes.
- Never trust client-provided identity, role, position, timer, or winner state.
- Validate incoming payload types, sizes, permissions, and rate limits before broadcasting.
- Update shared protocol types, both endpoints, and tests together when a message shape changes.
- Consider reconnects, duplicate messages, late metadata, disconnects, and clients joining during an active round.
- Do not expose concealed Hide & Seek coordinates through presence, metadata, logs, or secondary events.

### Frontend behavior

- Preserve keyboard and coarse-pointer controls when adding interactions.
- Avoid blocking movement shortcuts while a text input, modal, or whiteboard owns focus.
- Lazy-load media, whiteboard, and other heavy features when practical.
- Provide loading, empty, error, and disconnected states for networked UI.
- Check both desktop and narrow mobile layouts.

### API and security

- Validate request bodies with Zod and enforce authorization server-side.
- Return useful but non-sensitive error messages.
- Never log passwords, bearer tokens, LiveKit secrets, or complete production environment values.
- Use cryptographically secure randomness for security-sensitive identifiers or credentials.
- Preserve same-origin `/api` and `/socket` behavior unless the deployment documentation is updated with the change.

## Database changes

Prisma schema changes must include a committed migration. Do not use `prisma db push` as the production migration strategy.

```bash
cd metaverse/packages/db
bunx prisma migrate dev --name short_descriptive_name
```

Then verify that a clean database can migrate and seed successfully. Seed operations must remain idempotent because Compose runs them during deployment.

Do not edit an already-deployed migration. Add a new migration that moves the schema from the previous state to the desired state.

## Maps and media assets

- Only contribute assets you created or have the legal right to redistribute.
- Record the creator, source URL, license, and required attribution for third-party assets.
- Do not assume that an asset is reusable merely because it is publicly accessible.
- Optimize large images and audio without visibly degrading the experience.
- Keep map dimensions, collision grids, spawns, concealment zones, and gameplay configuration aligned.
- Run the Hide & Seek configuration tests after editing its map or collision data.

Code contributions are accepted under the MIT License. An asset with a different compatible license remains under that asset's stated license and must be documented accordingly.

## Testing

Run the fast suite and type checks for every code change:

```bash
cd metaverse
bun test
bun run check-types
```

Run a production frontend build for web, styling, shared-type, or bundling changes:

```bash
cd metaverse
bun run --cwd apps/web build
```

Run the cross-service suite for HTTP, WebSocket, authentication, database, room, study, chat, metadata, or LiveKit changes:

```bash
make docker-up
cd tests
pnpm install --frozen-lockfile
pnpm test -- --runInBand
```

The main README records the current test baseline. If a known failure is unrelated to your change, identify it explicitly in the pull request and show that your branch introduced no additional failures. Fixing the known baseline is encouraged; silently adding new failures is not.

Useful focused commands:

```bash
cd metaverse
bun test apps/ws
bun test apps/web/src/game/entities/playerLabel.test.ts
bun test --coverage
```

Documentation-only changes do not require the complete runtime suite, but formatting, commands, paths, and links should still be checked.

## Commit and pull-request guidelines

Write concise, imperative commit subjects that describe the outcome:

```text
Fix late player metadata labels
Add collision connectivity regression test
Document LiveKit TURN ports
```

Avoid vague subjects such as `updates`, `fix stuff`, or `changes`.

A good pull request includes:

- The user or engineering problem being solved.
- The chosen approach and important tradeoffs.
- Reproduction steps for a bug fix.
- Commands run and their results.
- Screenshots or a short recording for visual changes.
- Protocol, migration, environment, deployment, or rollback notes when applicable.
- Follow-up work that is intentionally outside the current scope.

Keep generated build output, dependency directories, local databases, and editor files out of the pull request.

## Pull-request checklist

- [ ] The change is focused and does not include unrelated cleanup.
- [ ] Shared types and both sides of changed protocols are synchronized.
- [ ] User input and authorization are validated on the server.
- [ ] Tests cover new behavior or the pull request explains why they are not applicable.
- [ ] Relevant Bun tests pass.
- [ ] Type checks pass.
- [ ] The production web build passes when frontend code changed.
- [ ] Integration results are included for cross-service changes.
- [ ] Desktop, keyboard, and mobile/touch behavior were considered for UI changes.
- [ ] Database changes include a migration and remain seed-compatible.
- [ ] New environment variables are documented in `.env.example` and `README.md`.
- [ ] New assets have redistribution rights and attribution information.
- [ ] No secrets, credentials, database dumps, or private user data are present.
- [ ] Documentation and deployment instructions reflect operational changes.

## Reporting security issues

Do not open a public issue for a vulnerability that could put users or the production deployment at risk. Use the repository's private GitHub security advisory flow or one of the private contact methods in the README's [Security section](README.md#security). Include the affected component, reproduction steps, potential impact, and any suggested mitigation.

Please allow time for the issue to be investigated before publishing technical details.

## License

By submitting a contribution, you agree that your code contribution is licensed under the repository's [MIT License](LICENSE). You confirm that you have the right to submit the contribution and that it does not knowingly infringe another party's rights.
