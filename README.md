# Company Sim

[![Check](https://github.com/brandonapol/company-sim/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/brandonapol/company-sim/actions/workflows/check.yml)
[![Test](https://github.com/brandonapol/company-sim/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/brandonapol/company-sim/actions/workflows/test.yml)
[![Build](https://github.com/brandonapol/company-sim/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/brandonapol/company-sim/actions/workflows/build.yml)
[![CodeQL](https://github.com/brandonapol/company-sim/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/brandonapol/company-sim/actions/workflows/codeql.yml)

A private, Slack-style practice ground for running a company as it grows from 2 people to 500.
Your employees are AI agents (Claude, Grok, Codex/GPT) with their own roles, opinions and blind spots.
A mentor reads everything you do and tells you how you are leading.

## What is in it

- **Channels and DMs** with employees who push back, bring ideas and ask you for decisions.
- **A curriculum of 27 general situations, plus four specific to Quark (focus vs breadth, the no-subscription revenue model, hardware inventory, support load),** across five company sizes (Founders 2-10, Team 11-25, Org 26-50, Company 51-100, Scale 101-500):
  first marketing hire, positioning, pricing, runway, first manager, underperformers, comp, org design, hiring executives,
  fundraising, boards, layoffs, exec conflict, planning and more. Each comes with a short primer, frameworks to look up, and a rubric.
- **Hiring**: open a role, get three candidates with real trade-offs, interview them in chat, make an offer. Or delegate hiring to a
  manager and stop meeting everyone, which is its own lesson.
- **A toy finance model** so every hire visibly moves burn and runway.
- **A decision log** where you write down what you decided and why.
- **A mentor** that reviews your messages, decisions and hiring briefs, scores six leadership dimensions and assigns practice.

## Noise and cost controls

Nothing runs in the background and nothing notifies you.

- Bots only speak when you post, or when you press **Run week**.
- Activity level (Silent / Quiet / Normal / Lively) caps replies per post and unprompted messages per week.
- A hard daily token budget, reply length and context size are all in Settings, with per-provider usage for the last 7 days.
- Optional auto-advance every N hours, which never fires during your quiet hours and only while the tab is open.
- No keys at all? Everything runs in mock mode with canned replies so you can try the flow for free.

## Run it

Requires Node 22.18+ and GNU Make.

```bash
make setup
make watch                         # UI on http://localhost:5173, API on :8787
```

Production, single process:

```bash
APP_PASSWORD=choose-one make serve # http://localhost:8787, user "ceo"
```

Container:

```bash
docker run -p 8787:8787 -e APP_PASSWORD=choose-one ghcr.io/brandonapol/company-sim:latest
# or, from a checkout:
make serve/docker APP_PASSWORD=choose-one
```

### Configuration

| Variable                                             | Purpose                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `APP_PASSWORD`                                       | Enables HTTP basic auth. Without it the server only listens on localhost. |
| `APP_USER`                                           | Basic auth user, default `ceo`.                                           |
| `PORT`, `HOST`                                       | Default `8787`; host is `0.0.0.0` when a password is set.                 |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY` | Optional server-side keys, used when the browser has none.                |

`/healthz` answers without credentials for container and load-balancer probes. Basic auth sends the password
with every request, so put this behind HTTPS if it leaves your machine. See [SECURITY.md](SECURITY.md).

## How it is built

- `server/`: a small Hono server. Basic auth, static files, and a stateless proxy to the three model APIs
  (`/api/chat`, `/api/models`). It stores nothing.
- `src/domain/`: pure functions for the simulation (who replies, finance, curriculum, prompts). Unit tested.
- `src/state/`: a tiny store persisted to IndexedDB in your browser, plus the actions that call models.
- `src/ui/`: React views.

All company data and API keys live in your browser. Keys are sent only to your own server, which forwards them to the provider.
Moving state to SQLite later means replacing `src/lib/storage.ts` with calls to the server.

```bash
make check     # format, lint, types, spelling, workflows, shell
make test      # unit + coverage, browser end-to-end, smoke
make help      # everything else
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development loop and CI, and [docs/release.md](docs/release.md)
for how releases are cut, verified and yanked.
