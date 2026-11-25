SHELL := bash
.SHELLFLAGS = -e -o pipefail -c
.DEFAULT_GOAL := help
.ONESHELL:
.SILENT:

MIN_MAKE := 3.82
ifneq ($(firstword $(sort $(MAKE_VERSION) $(MIN_MAKE))),$(MIN_MAKE))
$(error GNU Make $(MAKE_VERSION) is too old; this Makefile needs $(MIN_MAKE)+. \
On macOS run `brew install make` and use `gmake`.)
endif

ifneq (,$(wildcard ./.env))
    include .env
    export
endif

unexport GIT_DIR
unexport GIT_WORK_TREE
unexport GIT_PREFIX

# renovate: datasource=github-releases depName=rhysd/actionlint
ACTIONLINT_VERSION := v1.7.7

REPO := brandonapol/company-sim
BIN := $(CURDIR)/bin
ACTIONLINT := $(BIN)/actionlint

BUILD_NAME := $(or $(BUILD_NAME),$(shell git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null | sed -E 's/^v//'),0.0.0)
GIT_SHA := $(or $(GIT_SHA),$(shell git rev-parse --short=7 HEAD 2>/dev/null),unknown)
EXACT_TAG := $(shell git describe --tags --exact-match --match 'v[0-9]*' 2>/dev/null)
APP_VERSION := $(or $(APP_VERSION),$(if $(EXACT_TAG),$(BUILD_NAME),$(BUILD_NAME)-dev+$(GIT_SHA)))
export APP_VERSION

PORT ?= 8787
DOCKER_IMAGE ?= company-sim
DOCKER_TAG ?= $(subst +,-,$(APP_VERSION))
DOCKER_CONTAINER ?= company-sim
DOCKER_PORT ?= 8787
SMOKE_PORT ?= 8798
SMOKE_PASSWORD ?= smoke
RELEASE_DIR := release

##@ Setup

.PHONY: setup
setup: node_modules setup/hooks setup/actionlint ## Set up the development environment

node_modules: package-lock.json
	attempt=1
	until npm ci; do
		if [[ "$$attempt" -ge 3 ]]; then
			echo "npm ci failed three times. Check the registry is reachable and the lockfile is in sync (make tidy)."
			exit 1
		fi
		echo "npm ci failed (attempt $$attempt); retrying"
		attempt=$$((attempt + 1))
		sleep $$((attempt * 5))
	done
	touch node_modules

.PHONY: setup/hooks
setup/hooks: ## Install the git pre-commit hook
	ln -sf "$(CURDIR)/git/hooks/pre-commit" "$$(git rev-parse --git-path hooks)/pre-commit"
	echo "Git hooks installed"

.PHONY: setup/actionlint
setup/actionlint: $(ACTIONLINT) ## Install the pinned actionlint into ./bin

$(ACTIONLINT): Makefile
	mkdir -p "$(BIN)"
	version="$(ACTIONLINT_VERSION:v%=%)"
	case "$$(uname -s)-$$(uname -m)" in
		Linux-x86_64) platform=linux_amd64 ;;
		Linux-aarch64 | Linux-arm64) platform=linux_arm64 ;;
		Darwin-x86_64) platform=darwin_amd64 ;;
		Darwin-arm64) platform=darwin_arm64 ;;
		*) echo "No actionlint build for $$(uname -s)-$$(uname -m). Install it by hand into $(BIN)."; exit 1 ;;
	esac
	base="https://github.com/rhysd/actionlint/releases/download/$(ACTIONLINT_VERSION)"
	tmp="$$(mktemp -d)"
	trap 'rm -rf "$$tmp"' EXIT
	curl --fail --silent --show-error --location --retry 3 -o "$$tmp/actionlint.tar.gz" "$$base/actionlint_$${version}_$${platform}.tar.gz"
	curl --fail --silent --show-error --location --retry 3 -o "$$tmp/checksums.txt" "$$base/actionlint_$${version}_checksums.txt"
	line="$$(grep " actionlint_$${version}_$${platform}.tar.gz$$" "$$tmp/checksums.txt" || true)"
	if [[ -z "$$line" ]]; then
		echo "No checksum published for actionlint_$${version}_$${platform}.tar.gz; refusing to install it."
		exit 1
	fi
	want="$${line%% *}"
	if command -v sha256sum >/dev/null 2>&1; then
		got="$$(sha256sum "$$tmp/actionlint.tar.gz" | cut -d' ' -f1)"
	else
		got="$$(shasum -a 256 "$$tmp/actionlint.tar.gz" | cut -d' ' -f1)"
	fi
	if [[ "$$got" != "$$want" ]]; then
		echo "actionlint checksum mismatch: wanted $$want, got $$got."
		exit 1
	fi
	tar -xzf "$$tmp/actionlint.tar.gz" -C "$(BIN)" actionlint
	touch "$(ACTIONLINT)"
	echo "Installed actionlint $(ACTIONLINT_VERSION)"

.PHONY: setup/playwright
setup/playwright: node_modules ## Install the browser the e2e tests drive
	npx playwright install --with-deps chromium

##@ Build

.PHONY: build
build: node_modules ## Build the web UI into dist/
	npm run build

.PHONY: build/docker
build/docker: check/docker ## Build the container image for this checkout
	docker build \
		--build-arg VERSION="$(APP_VERSION)" \
		--build-arg GIT_SHA="$(GIT_SHA)" \
		-t "$(DOCKER_IMAGE):$(DOCKER_TAG)" .
	echo "Built $(DOCKER_IMAGE):$(DOCKER_TAG)"

.PHONY: build/release
build/release: check/build-name build ## Build the release tarball and its checksum into release/
	name="company-sim_$(BUILD_NAME)"
	rm -rf "$(RELEASE_DIR)"
	mkdir -p "$(RELEASE_DIR)/$$name/src"
	cp -R dist server package.json package-lock.json README.md "$(RELEASE_DIR)/$$name/"
	cp -R src/shared "$(RELEASE_DIR)/$$name/src/shared"
	find "$(RELEASE_DIR)/$$name" -name '*.test.ts' -delete
	printf '%s\n' "$(BUILD_NAME)" > "$(RELEASE_DIR)/$$name/VERSION"
	tar -czf "$(RELEASE_DIR)/$$name.tar.gz" -C "$(RELEASE_DIR)" "$$name"
	rm -rf "$(RELEASE_DIR)/$$name"
	cd "$(RELEASE_DIR)"
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$$name.tar.gz" > "company-sim_$(BUILD_NAME)_checksums.txt"
	else
		shasum -a 256 "$$name.tar.gz" > "company-sim_$(BUILD_NAME)_checksums.txt"
	fi
	echo "Wrote $(RELEASE_DIR)/$$name.tar.gz"

##@ Run

.PHONY: watch
watch: node_modules ## Run the API and the UI with hot reload (UI on :5173)
	npm run dev

.PHONY: serve
serve: build ## Serve the built app (PORT=8787; set APP_PASSWORD to turn on auth)
	PORT="$(PORT)" node server/index.ts

.PHONY: serve/docker
serve/docker: build/docker ## Run the container image (DOCKER_PORT=8787; APP_PASSWORD required)
	if [[ -z "$${APP_PASSWORD:-}" ]]; then
		echo "APP_PASSWORD is required: the container listens on all interfaces. Run 'make serve/docker APP_PASSWORD=...'."
		exit 1
	fi
	docker rm -f "$(DOCKER_CONTAINER)" >/dev/null 2>&1 || true
	docker run --rm --name "$(DOCKER_CONTAINER)" \
		--read-only --cap-drop ALL --security-opt no-new-privileges \
		-p "$(DOCKER_PORT):8787" \
		-e APP_PASSWORD \
		-e ANTHROPIC_API_KEY -e OPENAI_API_KEY -e XAI_API_KEY \
		"$(DOCKER_IMAGE):$(DOCKER_TAG)"

##@ Test

.PHONY: test
test: test/unit test/e2e test/smoke ## Run every test that needs no container

.PHONY: test/unit
test/unit: node_modules ## Run unit tests with coverage thresholds
	npm run test:coverage

.PHONY: test/e2e
test/e2e: build ## Drive the real UI in a browser, in mock mode (no API keys, no tokens)
	npx playwright test

.PHONY: test/smoke
test/smoke: build ## Start the built server and probe it
	APP_PASSWORD="$(SMOKE_PASSWORD)" PORT="$(SMOKE_PORT)" HOST=127.0.0.1 node server/index.ts >/dev/null &
	pid=$$!
	trap 'kill "$$pid" 2>/dev/null || true' EXIT
	SMOKE_PASSWORD="$(SMOKE_PASSWORD)" ./scripts/smoke.bash "http://127.0.0.1:$(SMOKE_PORT)" "$(APP_VERSION)"

.PHONY: test/smoke/docker
test/smoke/docker: build/docker ## Run the container image and probe it, including its own healthcheck
	name="company-sim-smoke-$$$$"
	docker run -d --rm --name "$$name" \
		--read-only --cap-drop ALL --security-opt no-new-privileges \
		-p "127.0.0.1:$(SMOKE_PORT):8787" -e APP_PASSWORD="$(SMOKE_PASSWORD)" \
		"$(DOCKER_IMAGE):$(DOCKER_TAG)" >/dev/null
	trap 'docker rm -f "$$name" >/dev/null 2>&1 || true' EXIT
	if ! SMOKE_PASSWORD="$(SMOKE_PASSWORD)" ./scripts/smoke.bash "http://127.0.0.1:$(SMOKE_PORT)" "$(APP_VERSION)"; then
		docker logs "$$name" || true
		exit 1
	fi
	user="$$(docker exec "$$name" id -u)"
	if [[ "$$user" == "0" ]]; then
		echo "The container runs as root. The image must set a non-root USER."
		exit 1
	fi
	for attempt in $$(seq 1 20); do
		health="$$(docker inspect --format '{{.State.Health.Status}}' "$$name")"
		if [[ "$$health" == "healthy" ]]; then
			echo "Container healthcheck: healthy"
			exit 0
		fi
		sleep 2
	done
	echo "Container healthcheck never reported healthy (last: $$health)."
	docker logs "$$name" || true
	exit 1

##@ Code quality

.PHONY: check
check: check/format check/lint check/types check/spelling check/lockfile check/actions ## Run every static check CI runs

.PHONY: check/fast
check/fast: node_modules ## Check staged files only (what the pre-commit hook runs)
	./scripts/check-fast.bash

.PHONY: check/format
check/format: node_modules ## Check formatting
	if ! npm run --silent format:check; then
		echo "Formatting is off. Run 'make format'."
		exit 1
	fi

.PHONY: check/lint
check/lint: node_modules ## Lint TypeScript
	npm run --silent lint

.PHONY: check/types
check/types: node_modules ## Typecheck
	npm run --silent typecheck

.PHONY: check/spelling
check/spelling: node_modules ## Check spelling in code and docs
	npm run --silent check:spelling

.PHONY: check/lockfile
check/lockfile: ## Check package-lock.json matches package.json
	if ! npm ci --dry-run --ignore-scripts >/dev/null 2>&1; then
		echo "package-lock.json is out of sync with package.json. Run 'make tidy' and commit the result."
		exit 1
	fi

.PHONY: check/actions
check/actions: $(ACTIONLINT) ## Lint GitHub Actions workflows, and require every action to be pinned to a commit
	"$(ACTIONLINT)" -color
	unpinned="$$(grep -rnE '^\s*-?\s*uses:\s+[^.][^@]*@' .github | grep -vE '@[0-9a-f]{40}(\s|$$)' || true)"
	if [[ -n "$$unpinned" ]]; then
		echo "These actions are not pinned to a full commit SHA:"
		echo "$$unpinned"
		echo "Pin each as owner/repo@<40-character sha> # vX.Y.Z so Renovate can keep it current."
		exit 1
	fi

.PHONY: check/vuln
check/vuln: node_modules ## Check dependencies for known vulnerabilities
	npm audit --omit=dev --audit-level=low
	npm audit --audit-level=high

.PHONY: check/docker
check/docker: ## Check that the Docker daemon is reachable
	if ! docker info >/dev/null 2>&1; then
		echo "The Docker daemon is not reachable. Start Docker, then run this again."
		exit 1
	fi

.PHONY: check/dockerfile
check/dockerfile: check/docker ## Lint the Dockerfile with BuildKit's checks
	docker build --check .

.PHONY: check/build-name
check/build-name: ## Check that there is a released version to build (a vX.Y.Z tag, or BUILD_NAME)
	if [[ ! "$(BUILD_NAME)" =~ ^[0-9]+\.[0-9]+\.[0-9]+$$ ]] || [[ "$(BUILD_NAME)" == "0.0.0" ]]; then
		echo "No version to build: '$(BUILD_NAME)'. Tag a release (make release/tag VERSION=vX.Y.Z) or pass BUILD_NAME=X.Y.Z."
		exit 1
	fi

.PHONY: check/clean-tree
check/clean-tree: ## Fail if the working tree has uncommitted changes
	if [[ -n "$$(git status --porcelain)" ]]; then
		git status --short
		echo "There are uncommitted changes. If a check or build produced them, commit the result."
		exit 1
	fi

.PHONY: format
format: node_modules ## Format every file
	npm run --silent format

.PHONY: tidy
tidy: ## Bring package-lock.json back in sync with package.json
	npm install --package-lock-only --ignore-scripts
	npm dedupe --package-lock-only --ignore-scripts

##@ Release

.PHONY: release/tag
release/tag: ## Tag and push a release from an up-to-date, clean main (VERSION=vX.Y.Z)
	if [[ ! "$(VERSION)" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$$ ]]; then
		echo "Usage: make release/tag VERSION=vX.Y.Z"
		exit 1
	fi
	branch="$$(git rev-parse --abbrev-ref HEAD)"
	if [[ "$$branch" != "main" ]]; then
		echo "Releases are cut from main; you are on $$branch."
		exit 1
	fi
	$(MAKE) check/clean-tree
	git fetch --quiet --tags origin main
	if [[ "$$(git rev-parse HEAD)" != "$$(git rev-parse origin/main)" ]]; then
		echo "Local main is not at origin/main. Pull or push first."
		exit 1
	fi
	if git rev-parse -q --verify "refs/tags/$(VERSION)" >/dev/null; then
		echo "Tag $(VERSION) already exists. Versions are never reused; pick the next one."
		exit 1
	fi
	git tag -a "$(VERSION)" -m "$(VERSION)"
	git push origin "$(VERSION)"
	echo "Pushed $(VERSION). The Release workflow builds and publishes it."

.PHONY: release/yank
release/yank: ## Yank a bad release: mark the GitHub release as a pre-release (VERSION=vX.Y.Z)
	if [[ ! "$(VERSION)" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$$ ]]; then
		echo "Usage: make release/yank VERSION=vX.Y.Z"
		exit 1
	fi
	if ! command -v gh >/dev/null 2>&1; then
		echo "gh is not installed. Install the GitHub CLI (https://cli.github.com), then run 'gh auth login'."
		exit 1
	fi
	gh release edit "$(VERSION)" --prerelease --repo "$(REPO)"
	echo "$(VERSION) is now a pre-release, so 'latest' no longer points at it."
	echo "The container tag ghcr.io/$(REPO):$(VERSION:v%=%) still exists. Ship a patch release, which moves ':latest'."

##@ Helpers

.PHONY: clean
clean: ## Remove build and test output
	rm -rf dist coverage playwright-report test-results "$(RELEASE_DIR)"

.PHONY: clean/all
clean/all: clean ## Also remove node_modules and downloaded tools
	rm -rf node_modules "$(BIN)"

.PHONY: clean/docker
clean/docker: ## Remove the container serve/docker started
	docker rm -f "$(DOCKER_CONTAINER)" >/dev/null 2>&1 || true

.PHONY: version
version: ## Print the version this checkout builds as
	echo "$(APP_VERSION)"

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z0-9_\/.-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
