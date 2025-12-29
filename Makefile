.PHONY: help install test lint format clean docker-up docker-down migrate dev-backend dev-frontend dev-fullstack validate-infra deploy-infra check-commits ngrok-start ngrok-stop ngrok-status ngrok-local

# Default target
help:
	@echo "Fundrbolt Platform - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install all dependencies (backend + frontend)"
	@echo "  make dev-backend      - Start backend development server"
	@echo "  make dev-frontend     - Start frontend development server"
	@echo "  make dev-fullstack    - Start both backend and frontend"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run all tests"
	@echo "  make test-backend     - Run backend tests with coverage"
	@echo "  make test-frontend    - Run frontend tests"
	@echo "  make test-watch       - Run backend tests in watch mode"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint             - Run linters (backend + frontend)"
	@echo "  make format           - Run formatters (backend + frontend)"
	@echo "  make type-check       - Run type checkers"
	@echo "  make check-commits    - Run pre-commit hooks (safe-commit)"
	@echo ""
	@echo "Database:"
	@echo "  make migrate          - Run database migrations"
	@echo "  make migrate-create   - Create new migration (use NAME=description)"
	@echo "  make migrate-down     - Rollback last migration"
	@echo "  make db-seed          - Seed test users"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up        - Start Docker services (PostgreSQL, Redis)"
	@echo "  make docker-down      - Stop Docker services"
	@echo "  make docker-logs      - Show Docker logs"
	@echo ""
	@echo "Ngrok (Mobile Testing):"
	@echo "  make ngrok-start      - Start ngrok tunnels and configure frontend"
	@echo "  make ngrok-stop       - Stop ngrok and restore local config"
	@echo "  make ngrok-status     - Show ngrok tunnel URLs"
	@echo "  make ngrok-local      - Switch frontend back to localhost"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make validate-infra   - Validate Bicep templates (ENV=dev|staging|production)"
	@echo "  make deploy-infra     - Deploy infrastructure (ENV=dev|staging|production)"
	@echo "  make deploy-backend   - Deploy backend (ENV=dev|staging|production TAG=version)"
	@echo "  make deploy-frontend  - Deploy frontend (ENV=dev|staging|production)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean            - Remove build artifacts and caches"
	@echo "  make clean-docker     - Remove Docker volumes and data"

# Installation
install: install-backend install-frontend

install-backend:
	@echo "Installing backend dependencies..."
	cd backend && poetry install

install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend/fundrbolt-admin && pnpm install

# Development servers
dev-backend:
	@echo "Starting backend development server..."
	cd backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0

dev-frontend:
	@echo "Starting frontend development server..."
	cd frontend/fundrbolt-admin && bash -c "source ~/.nvm/nvm.sh && nvm use 22 && pnpm dev"

dev-fullstack:
	@echo "Starting full stack (use separate terminals or Ctrl+C to stop)"
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:5173"
	@$(MAKE) -j2 dev-backend dev-frontend

# Testing
test: test-backend test-frontend

test-backend:
	@echo "Running backend tests..."
	cd backend && poetry run pytest app/tests -v --cov=app --cov-report=term-missing

test-frontend:
	@echo "Running frontend tests..."
	cd frontend/fundrbolt-admin && pnpm test

test-watch:
	@echo "Running backend tests in watch mode..."
	cd backend && poetry run pytest app/tests -v --watch

test-coverage:
	@echo "Running backend tests with HTML coverage report..."
	cd backend && poetry run pytest app/tests -v --cov=app --cov-report=html
	@echo "Coverage report: backend/htmlcov/index.html"

# Code quality
lint: lint-backend lint-frontend

lint-backend:
	@echo "Linting backend..."
	cd backend && poetry run ruff check .
	cd backend && poetry run mypy app

lint-frontend:
	@echo "Linting frontend..."
	cd frontend/fundrbolt-admin && pnpm lint

format: format-backend format-frontend

format-backend:
	@echo "Formatting backend..."
	cd backend && poetry run black .
	cd backend && poetry run ruff check --fix .

format-frontend:
	@echo "Formatting frontend..."
	cd frontend/fundrbolt-admin && pnpm format

type-check:
	@echo "Type checking..."
	cd backend && poetry run mypy app
	cd frontend/fundrbolt-admin && pnpm type-check

check-commits:
	@echo "Running pre-commit hooks..."
	./scripts/safe-commit.sh

# Database
migrate:
	@echo "Running database migrations..."
	cd backend && poetry run alembic upgrade head

migrate-create:
ifndef NAME
	@echo "Error: NAME is required. Usage: make migrate-create NAME='description'"
	@exit 1
endif
	@echo "Creating new migration: $(NAME)"
	cd backend && poetry run alembic revision --autogenerate -m "$(NAME)"

migrate-down:
	@echo "Rolling back last migration..."
	cd backend && poetry run alembic downgrade -1

migrate-history:
	@echo "Migration history:"
	cd backend && poetry run alembic history

db-seed:
	@echo "Seeding test users..."
	cd backend && poetry run python seed_test_users.py

# Docker
docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d
	@echo "PostgreSQL: localhost:5432"
	@echo "Redis: localhost:6379"

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down

docker-logs:
	@echo "Docker logs (Ctrl+C to exit):"
	docker-compose logs -f

docker-restart: docker-down docker-up

# Infrastructure
validate-infra:
ifndef ENV
	@echo "Error: ENV is required. Usage: make validate-infra ENV=dev"
	@exit 1
endif
	@echo "Validating Bicep templates for $(ENV)..."
	./infrastructure/scripts/validate.sh $(ENV)

deploy-infra:
ifndef ENV
	@echo "Error: ENV is required. Usage: make deploy-infra ENV=dev"
	@exit 1
endif
ifndef PASSWORD
	@echo "Error: PASSWORD is required. Usage: make deploy-infra ENV=dev PASSWORD='secure-password'"
	@exit 1
endif
	@echo "Deploying infrastructure to $(ENV)..."
	./infrastructure/scripts/provision.sh $(ENV) $(PASSWORD)

deploy-backend:
ifndef ENV
	@echo "Error: ENV is required. Usage: make deploy-backend ENV=dev TAG=v1.0.0"
	@exit 1
endif
ifndef TAG
	@echo "Error: TAG is required. Usage: make deploy-backend ENV=dev TAG=v1.0.0"
	@exit 1
endif
	@echo "Deploying backend to $(ENV) with tag $(TAG)..."
	./infrastructure/scripts/deploy-backend.sh $(ENV) $(TAG)

deploy-frontend:
ifndef ENV
	@echo "Error: ENV is required. Usage: make deploy-frontend ENV=dev"
	@exit 1
endif
ifndef TOKEN
	@echo "Error: TOKEN is required. Set AZURE_STATIC_WEB_APPS_API_TOKEN_$(shell echo $(ENV) | tr '[:lower:]' '[:upper:]')"
	@exit 1
endif
	@echo "Deploying frontend to $(ENV)..."
	./infrastructure/scripts/deploy-frontend.sh $(ENV) $(TOKEN)

run-migrations:
ifndef ENV
	@echo "Error: ENV is required. Usage: make run-migrations ENV=dev"
	@exit 1
endif
	@echo "Running migrations on $(ENV)..."
	./infrastructure/scripts/run-migrations.sh $(ENV)

configure-secrets:
ifndef ENV
	@echo "Error: ENV is required. Usage: make configure-secrets ENV=dev"
	@exit 1
endif
	@echo "Configuring secrets for $(ENV)..."
	./infrastructure/scripts/configure-secrets.sh $(ENV)

update-app-settings:
ifndef ENV
	@echo "Error: ENV is required. Usage: make update-app-settings ENV=dev"
	@exit 1
endif
	@echo "Updating App Service settings for $(ENV)..."
	./infrastructure/scripts/update-app-settings.sh $(ENV)

rollback:
ifndef COMPONENT
	@echo "Error: COMPONENT is required. Usage: make rollback COMPONENT=backend [TAG=v1.0.0]"
	@exit 1
endif
	@echo "Rolling back $(COMPONENT)..."
	./infrastructure/scripts/rollback.sh $(COMPONENT) $(TAG)

# Cleanup
clean:
	@echo "Cleaning build artifacts and caches..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "build" -exec rm -rf {} + 2>/dev/null || true
	cd backend && rm -rf htmlcov coverage.xml .coverage 2>/dev/null || true
	@echo "Clean complete!"

clean-docker:
	@echo "Removing Docker volumes and data..."
	docker-compose down -v
	@echo "Docker cleanup complete!"

# Utility
check-servers:
	@echo "Checking running servers..."
	./check-servers.sh

kill-backend:
	@echo "Stopping backend server..."
	pkill -f 'uvicorn app.main:app' || echo "Backend not running"

kill-frontend:
	@echo "Stopping frontend server..."
	pkill -f 'vite/bin/vite.js' || echo "Frontend not running"

kill-all: kill-backend kill-frontend

# Ngrok for mobile testing
ngrok-start:
	@echo "Starting ngrok tunnels..."
	@pkill ngrok 2>/dev/null || true
	@nohup ngrok start --all --config ngrok.yml > /tmp/ngrok.log 2>&1 & echo $$! > /tmp/ngrok.pid
	@sleep 3
	@echo "Configuring frontend to use ngrok backend..."
	@sed -i 's|VITE_API_URL=http://localhost:8000/api/v1|VITE_API_URL=https://fundrbolt-backend.ngrok.io/api/v1|g' frontend/fundrbolt-admin/.env
	@echo "Restarting frontend..."
	@pkill -f 'vite/bin/vite.js' || true
	@sleep 1
	@(bash -c "cd frontend/fundrbolt-admin && source ~/.nvm/nvm.sh && nvm use 22 && nohup pnpm dev > /tmp/frontend-ngrok.log 2>&1 &") || true
	@sleep 3
	@echo ""
	@echo "✅ Ngrok tunnels started!"
	@echo ""
	@curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | "  \(.public_url) -> \(.config.addr)"' || echo "  Frontend: https://fundrbolt-frontend.ngrok.io\n  Backend: https://fundrbolt-backend.ngrok.io"
	@echo ""
	@echo "📱 Open https://fundrbolt-frontend.ngrok.io on your phone"
	@echo ""

ngrok-stop:
	@echo "Stopping ngrok..."
	@pkill ngrok 2>/dev/null || true
	@$(MAKE) ngrok-local
	@echo "✅ Ngrok stopped and config restored to localhost"

ngrok-status:
	@echo "Ngrok tunnel status:"
	@curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[] | "  \(.public_url) -> \(.config.addr)"' || echo "  Ngrok not running"

ngrok-local:
	@echo "Switching frontend back to localhost..."
	@sed -i 's|VITE_API_URL=https://fundrbolt-backend.ngrok.io/api/v1|VITE_API_URL=http://localhost:8000/api/v1|g' frontend/fundrbolt-admin/.env
	@echo "Restarting frontend..."
	@pkill -f 'vite/bin/vite.js' || true
	@sleep 1
	@(bash -c "cd frontend/fundrbolt-admin && source ~/.nvm/nvm.sh && nvm use 22 && nohup pnpm dev > /tmp/frontend.log 2>&1 &") || true
	@sleep 2
	@echo "✅ Frontend configured for localhost:8000"

# Quick shortcuts
.PHONY: b f t m
b: dev-backend
f: dev-frontend
t: test
m: migrate
