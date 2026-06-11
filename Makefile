SHELL := /bin/bash

TEST_PROJECT_DIR ?= /tmp/test-alembic-project
TEST_DB_PORT ?= 55432
TEST_DB_NAME ?= alembic_test
TEST_DB_USER ?= alembic
TEST_DB_PASSWORD ?= alembic
PYTHON ?= python3
VENV := $(TEST_PROJECT_DIR)/venv
PIP := $(VENV)/bin/pip
ALEMBIC := $(VENV)/bin/alembic

.PHONY: help install typecheck lint lint-fix format format-check compile package test watch \
	test-project test-project-init test-project-migration test-db-up test-db-down test-db-logs \
	test-db-history test-db-current test-db-upgrade test-db-downgrade test-db-reset \
	launch-test print-test-path

help:
	@echo "Available targets:"
	@echo "  make install                 Install npm dependencies"
	@echo "  make typecheck               Run TypeScript checks"
	@echo "  make lint                    Run ESLint"
	@echo "  make lint-fix                Run ESLint with fixes"
	@echo "  make format-check            Check Prettier formatting"
	@echo "  make format                  Format files with Prettier"
	@echo "  make compile                 Type-check, lint, and bundle extension"
	@echo "  make package                 Build production extension bundle"
	@echo "  make test                    Run VS Code extension tests"
	@echo "  make watch                   Run TypeScript and esbuild watchers"
	@echo "  make test-project            Create local Alembic/Postgres test project"
	@echo "  make test-project-init       Alias for test-project"
	@echo "  make test-project-migration  Create an autogenerate sample migration"
	@echo "  make test-db-up              Start test Postgres container"
	@echo "  make test-db-down            Stop test Postgres container"
	@echo "  make test-db-logs            Show test Postgres logs"
	@echo "  make test-db-history         Run alembic history"
	@echo "  make test-db-current         Run alembic current"
	@echo "  make test-db-upgrade         Run alembic upgrade head"
	@echo "  make test-db-downgrade       Run alembic downgrade base"
	@echo "  make test-db-reset           Stop container and remove DB volume"
	@echo "  make launch-test             Open test project with this extension in dev mode"
	@echo ""
	@echo "Variables:"
	@echo "  TEST_PROJECT_DIR=$(TEST_PROJECT_DIR)"
	@echo "  TEST_DB_PORT=$(TEST_DB_PORT)"
	@echo "  TEST_DB_NAME=$(TEST_DB_NAME)"
	@echo "  TEST_DB_USER=$(TEST_DB_USER)"
	@echo "  TEST_DB_PASSWORD=$(TEST_DB_PASSWORD)"
	@echo "  PYTHON=$(PYTHON)"

install:
	npm install

typecheck:
	npm run check-types

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format-check:
	npm run format:check

format:
	npm run format

compile:
	npm run compile

package:
	npm run package

test:
	npm test

watch:
	npm run watch

test-project:
	TEST_PROJECT_DIR="$(TEST_PROJECT_DIR)" TEST_DB_PORT="$(TEST_DB_PORT)" \
		TEST_DB_NAME="$(TEST_DB_NAME)" TEST_DB_USER="$(TEST_DB_USER)" \
		TEST_DB_PASSWORD="$(TEST_DB_PASSWORD)" PYTHON="$(PYTHON)" \
		bash scripts/setup_test_project.sh

test-project-init: test-project
	@true

test-project-migration: test-db-up
	cd "$(TEST_PROJECT_DIR)" && "$(ALEMBIC)" upgrade head
	cd "$(TEST_PROJECT_DIR)" && "$(ALEMBIC)" revision --autogenerate -m "create users table"

test-db-up: test-project
	cd "$(TEST_PROJECT_DIR)" && docker compose up -d
	@echo "Waiting for Postgres to accept connections..."
	@for i in {1..30}; do \
		if cd "$(TEST_PROJECT_DIR)" && docker compose exec -T postgres pg_isready -U "$(TEST_DB_USER)" -d "$(TEST_DB_NAME)" >/dev/null 2>&1; then \
			echo "Postgres is ready."; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "Postgres did not become ready in time."; \
	exit 1

test-db-down:
	cd "$(TEST_PROJECT_DIR)" && docker compose down

test-db-logs:
	cd "$(TEST_PROJECT_DIR)" && docker compose logs -f postgres

test-db-history: test-project
	cd "$(TEST_PROJECT_DIR)" && "$(ALEMBIC)" history

test-db-current: test-db-up
	cd "$(TEST_PROJECT_DIR)" && "$(ALEMBIC)" current

test-db-upgrade: test-db-up
	cd "$(TEST_PROJECT_DIR)" && "$(ALEMBIC)" upgrade head

test-db-downgrade: test-db-up
	cd "$(TEST_PROJECT_DIR)" && "$(ALEMBIC)" downgrade base

test-db-reset:
	cd "$(TEST_PROJECT_DIR)" && docker compose down -v

launch-test: test-project
	code --extensionDevelopmentPath="$(CURDIR)" "$(TEST_PROJECT_DIR)"

print-test-path:
	@echo "$(TEST_PROJECT_DIR)"
