# TrueMetaverse

TrueMetaverse is a multiplayer virtual-space application built from a React/Phaser web client, an Express HTTP control plane, a WebSocket realtime service, PostgreSQL, and LiveKit media.

## Run with Docker

```bash
cp .env.example .env
make docker-up
```

Open <http://localhost:5173>. Follow logs with `make docker-logs` and stop without deleting data with `make docker-down`.

## Run services directly

The original host-development workflow remains available:

```bash
make setup
make run
```

This gives Vite hot reload while using Docker only for PostgreSQL. LiveKit can be started independently with:

```bash
docker compose -f metaverse/livekit/docker-compose.yml up -d
```
