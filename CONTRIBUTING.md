# Contributing

## Setup

Needs Node (the version in `.nvmrc`), GNU Make 3.82+, and for the full gate `shellcheck` and Docker.

```bash
make setup     # dependencies, git hooks, pinned actionlint
make watch     # API on :8787, UI with hot reload on :5173
make help      # every target
```

## The loop

| When               | Run                      | What it covers                                                    |
| ------------------ | ------------------------ | ----------------------------------------------------------------- |
| On commit (hook)   | `make check/fast`        | Format, lint and spelling on staged files only                    |
| Before pushing     | `make check`             | Format, lint, types, spelling, lockfile, workflows, shell scripts |
| Before pushing     | `make test`              | Unit tests with coverage, browser end-to-end, server smoke        |
| Touching the image | `make test/smoke/docker` | Builds the image, runs it locked down, checks its healthcheck     |

CI runs exactly these targets. If it passes locally it passes there; if CI needs something new, add a make
target and call it from the workflow, never a script that only exists in YAML.

Tests never call a real model. The end-to-end suite runs in mock mode, and the server tests inject a fake
upstream. Anything that needs a real provider is a manual test: say which provider in the pull request.

## Conventions

- TypeScript, functional style: plain data and pure functions in `src/domain`, effects in `src/state/actions.ts`.
  The linter rejects classes and loops.
- No code comments unless they explain something the code cannot. Workflows and the Makefile are the exception:
  a comment there should say why a step exists.
- Error messages say what to do next.
- One focused commit per pull request; linear history.
- Commits are authored by you alone. The commit-msg hook rejects AI attribution (a Claude co-author trailer, a
  "Generated with Claude Code" footer, a session link), and the `pr-text` workflow rejects the footer in a pull
  request's title, description or commits.
- Changing what the simulation costs to run (more model calls, longer prompts, more unprompted messages) must
  respect the activity level and the daily token budget, and be called out in the pull request.

## CI at a glance

| Workflow           | Runs on                      | Jobs                                                                    |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| Check code quality | PRs, main                    | code checks, workflow and shell lint, Dockerfile lint, dependency audit |
| Test               | PRs, main                    | unit + coverage, end-to-end, smoke, container smoke                     |
| Build              | PRs, main                    | release tarball dry run, amd64 + arm64 image build                      |
| CodeQL             | PRs, main, weekly            | TypeScript and workflow analysis                                        |
| pr-text            | PRs, including edits         | no AI attribution footer in the title, description or commits           |
| Release            | `vX.Y.Z` tags                | gate, GitHub release, container release                                 |
| Docker Release     | manual, or called by Release | multi-arch image to GHCR                                                |

Actions are pinned to commit SHAs (`make check/actions` enforces it) and Renovate keeps them current.
Releases are described in [docs/release.md](docs/release.md).

Suggested branch protection for `main`: require the Check, Test, Build and CodeQL jobs, require linear
history, and enable the merge queue (the workflows already listen for `merge_group`).
