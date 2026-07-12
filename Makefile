SHELL := /bin/bash
.DEFAULT_GOAL := help

DB_CONTAINER := metaverse-test-db
DB_IMAGE     := postgres:16
DB_PORT      := 5432
DB_PASSWORD  := mysecretpassword
export DATABASE_URL := postgresql://postgres:$(DB_PASSWORD)@localhost:$(DB_PORT)/postgres

MV       := metaverse
HTTP_DIR := $(MV)/apps/http
WS_DIR   := $(MV)/apps/ws
WEB_DIR  := $(MV)/apps/web
DB_DIR   := $(MV)/packages/db

.PHONY: help run db wait-db install db-push seed setup stop clean

help:
	@echo "Metaverse dev stack"
	@echo ""
	@echo "  make run      start postgres + api (:3000) + ws (:3001) + web (:5173)"
	@echo "  make setup    first-time: install deps, start db, push schema, seed"
	@echo "  make db       ensure the postgres container is up"
	@echo "  make install  bun install"
	@echo "  make db-push  apply the prisma schema to the database"
	@echo "  make seed     seed the database"
	@echo "  make stop     stop the postgres container"
	@echo "  make clean    remove the postgres container"

run: db
	@echo ""
	@echo "starting metaverse  ->  api :3000   ws :3001   web http://localhost:5173"
	@echo "press Ctrl-C to stop everything"
	@echo ""
	@trap 'kill 0' INT TERM; \
	( cd $(HTTP_DIR) && bun index.ts 2>&1 | sed -u 's/^/\x1b[36m[api]\x1b[0m /' ) & \
	( cd $(WS_DIR)   && bun index.ts 2>&1 | sed -u 's/^/\x1b[35m[ws] \x1b[0m /' ) & \
	( cd $(WEB_DIR)  && bun run dev  2>&1 | sed -u 's/^/\x1b[32m[web]\x1b[0m /' ) & \
	wait

db:
	@if docker ps --format '{{.Names}}' | grep -qx $(DB_CONTAINER); then \
		echo "-> postgres ($(DB_CONTAINER)) already running"; \
	elif docker ps -a --format '{{.Names}}' | grep -qx $(DB_CONTAINER); then \
		echo "-> starting existing postgres container..."; \
		docker start $(DB_CONTAINER) >/dev/null; \
	else \
		echo "-> creating postgres container ($(DB_IMAGE))..."; \
		docker run -d --name $(DB_CONTAINER) \
			-e POSTGRES_PASSWORD=$(DB_PASSWORD) \
			-p $(DB_PORT):$(DB_PORT) $(DB_IMAGE) >/dev/null; \
	fi
	@$(MAKE) --no-print-directory wait-db

wait-db:
	@echo "-> waiting for postgres to accept connections..."
	@until docker exec $(DB_CONTAINER) pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done
	@echo "-> postgres ready on :$(DB_PORT)"

install:
	cd $(MV) && bun install

db-push:
	cd $(DB_DIR) && bunx prisma db push

seed:
	cd $(DB_DIR) && bun run seed.ts

setup: install db db-push seed
	@echo ""
	@echo "setup complete - run 'make run' to start the app"

stop:
	@docker stop $(DB_CONTAINER) >/dev/null 2>&1 && echo "postgres stopped" || echo "postgres not running"

clean:
	@docker rm -f $(DB_CONTAINER) >/dev/null 2>&1 && echo "postgres container removed" || echo "no container to remove"
