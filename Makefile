# Claw Marketplace dev orchestration
#
# Run components in separate terminals so logs stay visible:
#   Terminal 1:  make db-up   (one-shot, then leaves DB running)
#                make api     (foreground; magic-link tokens log here)
#   Terminal 2:  make web     (foreground; Next.js dev server on :3000)
#   Terminal 3:  make worker-run   (optional, against running API)
#
# Or, all at once with logs interleaved (less clear, but one terminal):
#   make up
#   make logs
#   make down

ROOT := $(shell pwd)
BACKEND := $(ROOT)/backend
WEB := $(ROOT)/web
WORKER := $(ROOT)/worker
PIDS_DIR := $(ROOT)/.pids
LOGS_DIR := $(ROOT)/.logs

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Help

.PHONY: help
help:
	@echo ""
	@echo "  Claw Marketplace — make targets"
	@echo ""
	@echo "  Setup (one-time):"
	@echo "    make install        Install backend + web deps; bootstrap host (uv, mlx-lm, lima)"
	@echo ""
	@echo "  Foreground (recommended — run each in its own terminal):"
	@echo "    make api            Start the FastAPI backend on :8000"
	@echo "    make web            Start the Next.js dev server on :3000"
	@echo "    make worker-run     Run the worker; prompts you to mint a token"
	@echo ""
	@echo "  Background (PIDs in .pids/, logs in .logs/):"
	@echo "    make up             Start db + api + web in background"
	@echo "    make down           Stop all backgrounded processes"
	@echo "    make logs           tail -F all backgrounded service logs"
	@echo "    make status         Show what's running and on which ports"
	@echo ""
	@echo "  Database:"
	@echo "    make db-up          Start Postgres docker container (idempotent)"
	@echo "    make db-down        Stop Postgres (keeps volume)"
	@echo "    make db-reset       Drop + recreate volume + re-run migrations"
	@echo "    make db-shell       psql into claw_dev"
	@echo "    make migrate        alembic upgrade head"
	@echo ""
	@echo "  Worker:"
	@echo "    make worker-build   cargo build --release --target aarch64-apple-darwin"
	@echo "    make worker-test    cargo test --all-targets"
	@echo ""
	@echo "  Tests:"
	@echo "    make test           Run backend pytest + worker cargo test"
	@echo ""
	@echo "  Demo helpers:"
	@echo "    make seed-demo      Create demo supplier+offerings+booking+chat"
	@echo "    make magic EMAIL=you@example.com"
	@echo "                        Mint a magic-link, print the verify URL"
	@echo "    make dev-bypass     Toggle CLAW_DEV_BYPASS_AUTH=1 in web/.env.local"
	@echo "                        (no-login mode for browsing all pages)"
	@echo "    make dev-bypass-off Remove the bypass flags"
	@echo ""
	@echo "  Drive the worker (requires 'make up' so api.log exists):"
	@echo "    make demo-start  EMAIL=you@example.com [MSG=\"hi\"]"
	@echo "                        Hire offering, transition to active, send chat"
	@echo "    make demo-chat   EMAIL=... BID=... MSG=\"...\""
	@echo "    make demo-cancel EMAIL=... BID=..."
	@echo "    make demo-show   EMAIL=... BID=..."
	@echo ""
	@echo "  Cleanup:"
	@echo "    make clean          Stop everything, drop DB volume, remove .pids/.logs"
	@echo ""

# ---------------------------------------------------------------------------
# Setup

.PHONY: install
install:
	cd $(BACKEND) && uv sync
	cd $(WEB) && pnpm install --frozen-lockfile
	$(WORKER)/scripts/bootstrap-host-deps.sh

# ---------------------------------------------------------------------------
# Database

.PHONY: db-up db-down db-reset db-shell migrate
db-up:
	cd $(BACKEND) && docker compose up -d
	@until docker compose -f $(BACKEND)/docker-compose.yml ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; do sleep 1; done
	@docker compose -f $(BACKEND)/docker-compose.yml exec -T db \
	  psql -U claw -d claw_dev -tAc "SELECT 1 FROM pg_database WHERE datname='claw_test'" | grep -q 1 || \
	  docker compose -f $(BACKEND)/docker-compose.yml exec -T db \
	    psql -U claw -d claw_dev -c "CREATE DATABASE claw_test" >/dev/null
	@echo "✔ db healthy on :5432 (claw_dev + claw_test)"

db-down:
	cd $(BACKEND) && docker compose down

db-reset:
	cd $(BACKEND) && docker compose down -v
	$(MAKE) db-up
	$(MAKE) migrate

db-shell:
	cd $(BACKEND) && docker compose exec db psql -U claw -d claw_dev

migrate: db-up
	cd $(BACKEND) && uv run alembic upgrade head

# ---------------------------------------------------------------------------
# Foreground services (recommended — logs stay in your terminal)

.PHONY: api web worker-build worker-run worker-test
api: db-up migrate
	@mkdir -p $(LOGS_DIR)
	@echo "→ FastAPI on http://localhost:8000"
	@echo "  Magic-link tokens print here AND tee to $(LOGS_DIR)/api.log"
	@echo "  (so 'make demo-start' can grep them automatically)"
	@echo
	cd $(BACKEND) && uv run uvicorn claw_api.main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | tee -a $(LOGS_DIR)/api.log

web:
	@echo "→ Next.js dev on http://localhost:3000"
	cd $(WEB) && pnpm dev --port 3000

worker-build:
	cd $(WORKER) && cargo build --release --target aarch64-apple-darwin

worker-test:
	cd $(WORKER) && cargo test --all-targets

worker-run: worker-build
	@if [ -z "$$CLAW_API_URL" ]; then \
	  echo "Set CLAW_API_URL (default http://localhost:8000)"; \
	  CLAW_API_URL=http://localhost:8000; \
	fi; \
	if [ -z "$$CLAW_WORKER_TOKEN" ]; then \
	  echo "No CLAW_WORKER_TOKEN set."; \
	  echo "Either:"; \
	  echo "  1. Set CLAW_PROVISIONING_TOKEN and run: $(WORKER)/target/aarch64-apple-darwin/release/claw-worker register"; \
	  echo "  2. Or use 'make worker-token EMAIL=you@example.com' to mint one end-to-end"; \
	  exit 1; \
	fi; \
	$(WORKER)/target/aarch64-apple-darwin/release/claw-worker run --api-url $$CLAW_API_URL --worker-token $$CLAW_WORKER_TOKEN

# Mint a worker token end-to-end (api must be running). Sets up a supplier
# if needed, then prints CLAW_WORKER_TOKEN for shell export.
.PHONY: worker-token
worker-token:
	@if [ -z "$(EMAIL)" ]; then echo "usage: make worker-token EMAIL=you@example.com"; exit 1; fi
	@bash $(ROOT)/scripts/mint-worker-token.sh "$(EMAIL)"

# ---------------------------------------------------------------------------
# Background mode (api + web + db)
#
# PIDs land in .pids/, logs in .logs/. Use `make logs` to tail.

.PHONY: up down logs status
up: db-up
	@mkdir -p $(PIDS_DIR) $(LOGS_DIR)
	@if [ -f "$(PIDS_DIR)/api.pid" ] && kill -0 $$(cat $(PIDS_DIR)/api.pid) 2>/dev/null; then \
	  echo "  api already up (pid $$(cat $(PIDS_DIR)/api.pid))"; \
	else \
	  cd $(BACKEND) && nohup uv run uvicorn claw_api.main:app --host 0.0.0.0 --port 8000 \
	    > $(LOGS_DIR)/api.log 2>&1 & echo $$! > $(PIDS_DIR)/api.pid; \
	  echo "  api started → $(LOGS_DIR)/api.log (pid $$(cat $(PIDS_DIR)/api.pid))"; \
	fi
	@if [ -f "$(PIDS_DIR)/web.pid" ] && kill -0 $$(cat $(PIDS_DIR)/web.pid) 2>/dev/null; then \
	  echo "  web already up (pid $$(cat $(PIDS_DIR)/web.pid))"; \
	else \
	  cd $(WEB) && nohup pnpm dev --port 3000 > $(LOGS_DIR)/web.log 2>&1 & echo $$! > $(PIDS_DIR)/web.pid; \
	  echo "  web started → $(LOGS_DIR)/web.log (pid $$(cat $(PIDS_DIR)/web.pid))"; \
	fi
	@echo
	@echo "  → http://localhost:3000   (Next.js)"
	@echo "  → http://localhost:8000/v1/health   (FastAPI)"
	@echo "  Tail logs:  make logs"
	@echo "  Stop all:   make down"

down:
	@for svc in api web; do \
	  pidfile=$(PIDS_DIR)/$$svc.pid; \
	  if [ -f $$pidfile ]; then \
	    pid=$$(cat $$pidfile); \
	    if kill -0 $$pid 2>/dev/null; then \
	      kill $$pid && echo "  stopped $$svc (pid $$pid)"; \
	    fi; \
	    rm -f $$pidfile; \
	  fi; \
	done
	@echo "  (db left running — use 'make db-down' to stop Postgres too)"

logs:
	@mkdir -p $(LOGS_DIR)
	@touch $(LOGS_DIR)/api.log $(LOGS_DIR)/web.log
	tail -F $(LOGS_DIR)/api.log $(LOGS_DIR)/web.log

status:
	@echo "=== ports listening ==="
	@lsof -i :8000 -i :3000 -i :5432 -sTCP:LISTEN -P 2>/dev/null | head -10 || echo "  (none)"
	@echo
	@echo "=== docker ==="
	@docker compose -f $(BACKEND)/docker-compose.yml ps --format "table {{.Service}}\t{{.Status}}"
	@echo
	@echo "=== background pids ==="
	@for svc in api web; do \
	  pidfile=$(PIDS_DIR)/$$svc.pid; \
	  if [ -f $$pidfile ]; then \
	    pid=$$(cat $$pidfile); \
	    if kill -0 $$pid 2>/dev/null; then \
	      echo "  $$svc: running (pid $$pid)"; \
	    else \
	      echo "  $$svc: stale pid file"; \
	    fi; \
	  else \
	    echo "  $$svc: not running"; \
	  fi; \
	done

# ---------------------------------------------------------------------------
# Tests

.PHONY: test test-backend test-worker test-web
test: test-backend test-worker
	@echo "✔ backend + worker green"

test-backend: db-up migrate
	cd $(BACKEND) && uv run pytest -v

test-worker:
	cd $(WORKER) && cargo test --all-targets

test-web:
	cd $(WEB) && pnpm build

# ---------------------------------------------------------------------------
# Demo helpers

.PHONY: magic seed-demo dev-bypass dev-bypass-off demo-start demo-chat demo-cancel demo-show
# Drive the worker end-to-end without touching the UI.
#   make demo-start  EMAIL=you@example.com [MSG="hi"] [OFFERING_ID=...]
#   make demo-chat   EMAIL=... BID=... MSG="another"
#   make demo-cancel EMAIL=... BID=...
#   make demo-show   EMAIL=... BID=...
demo-start:
	@if [ -z "$(EMAIL)" ]; then echo "usage: make demo-start EMAIL=you@example.com [MSG=...] [OFFERING_ID=...]"; exit 1; fi
	@bash $(ROOT)/scripts/demo-flow.sh start "$(EMAIL)" "$(MSG)" "$(OFFERING_ID)"

demo-chat:
	@if [ -z "$(EMAIL)" ] || [ -z "$(BID)" ] || [ -z "$(MSG)" ]; then echo "usage: make demo-chat EMAIL=... BID=... MSG=\"...\""; exit 1; fi
	@bash $(ROOT)/scripts/demo-flow.sh chat "$(EMAIL)" "$(BID)" "$(MSG)"

demo-cancel:
	@if [ -z "$(EMAIL)" ] || [ -z "$(BID)" ]; then echo "usage: make demo-cancel EMAIL=... BID=..."; exit 1; fi
	@bash $(ROOT)/scripts/demo-flow.sh cancel "$(EMAIL)" "$(BID)"

demo-show:
	@if [ -z "$(EMAIL)" ] || [ -z "$(BID)" ]; then echo "usage: make demo-show EMAIL=... BID=..."; exit 1; fi
	@bash $(ROOT)/scripts/demo-flow.sh show "$(EMAIL)" "$(BID)"

magic:
	@if [ -z "$(EMAIL)" ]; then echo "usage: make magic EMAIL=you@example.com"; exit 1; fi
	@curl -fsS -X POST http://localhost:8000/v1/auth/magic-link -H 'Content-Type: application/json' -d '{"email":"$(EMAIL)"}' >/dev/null
	@sleep 0.3
	@TOK=$$(grep -E "MAGIC LINK for $(EMAIL)" $(LOGS_DIR)/api.log 2>/dev/null | tail -1 | sed 's/.*token=//'); \
	if [ -z "$$TOK" ]; then \
	  echo "(token not found in $(LOGS_DIR)/api.log; if api is running in foreground, copy from there)"; \
	else \
	  echo ""; \
	  echo "  🔑 Sign in:"; \
	  echo "  http://localhost:3000/auth/verify?token=$$TOK"; \
	  echo ""; \
	fi

seed-demo:
	@bash $(ROOT)/scripts/seed-demo.sh

dev-bypass:
	@bash $(ROOT)/scripts/dev-bypass.sh on

dev-bypass-off:
	@bash $(ROOT)/scripts/dev-bypass.sh off

# ---------------------------------------------------------------------------
# Cleanup

.PHONY: clean
clean: down
	cd $(BACKEND) && docker compose down -v
	rm -rf $(PIDS_DIR) $(LOGS_DIR)
	rm -rf $(WORKER)/target $(WEB)/.next $(WEB)/node_modules
	@echo "✔ stopped, dropped volumes, cleared build artefacts"
