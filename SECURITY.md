# Security

## Reporting a vulnerability

Please do not open a public issue. File a private advisory at
https://github.com/brandonapol/company-sim/security/advisories/new.

## What this app protects, and how

- **The page and the API** sit behind HTTP basic auth when `APP_PASSWORD` is set. Without a password the
  server binds to localhost only. Basic auth sends the password on every request, so terminate TLS in front
  of it (a reverse proxy or an ingress) whenever it is reachable from another machine.
- **Model API keys** are stored in the browser (IndexedDB) or in the server's environment. Browser keys are
  sent to this server in the `x-llm-key` header and forwarded only to the provider you selected. The server
  never writes keys, prompts or replies to disk or to its logs, and `/api/health` reports only whether a
  server-side key exists.
- **The proxy** talks to three fixed hosts (Anthropic, OpenAI, xAI). The provider is validated against that
  list, so it cannot be pointed at an arbitrary URL.
- **`/healthz`** is intentionally unauthenticated so container and load-balancer probes work. It returns only
  `ok` and the version.
- **The container** runs as a non-root user and works with a read-only root filesystem and all capabilities
  dropped (`make serve/docker` runs it that way).

## Supply chain

- GitHub Actions are pinned to commit SHAs, enforced by `make check/actions`.
- Dependencies are locked; `make check/vuln` (npm audit) runs on every pull request and on release.
- Release images are published with build provenance and an SBOM attached.
- Renovate keeps actions, dependencies, the Node version and Makefile tool pins current.
