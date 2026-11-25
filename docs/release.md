# Release process

## What a release is

A `vX.Y.Z` git tag on `main`. Pushing one runs the Release workflow, which:

1. **Gate.** Checks the tag format, checks the tagged commit is on `main`, then re-runs the full gate:
   `make check`, `make check/vuln`, unit tests with coverage, browser end-to-end tests and the smoke test.
2. **GitHub release.** Builds `company-sim_X.Y.Z.tar.gz` with `make build/release`, and publishes it with a
   checksum file and generated notes.
3. **Container.** Builds `linux/amd64` and `linux/arm64` images, pushes
   `ghcr.io/brandonapol/company-sim:X.Y.Z` and moves `:latest`, with build provenance and an SBOM attached,
   then pulls the image by digest and proves it starts, reports version `X.Y.Z` and is healthy.

The version is never written in a file in the repo. It comes from the tag, so a build cannot claim a version
that was not released. Between tags, builds report `X.Y.Z-dev+<sha>`.

## Releasing

```bash
git switch main && git pull
make release/tag VERSION=v0.2.0
```

`release/tag` refuses unless you are on `main`, the tree is clean, `main` matches `origin/main`, and the tag
does not exist yet. Versions are never reused.

Pick the number by what changed for someone running the app: patch for fixes, minor for features, major when
saved browser state or configuration from the previous version stops working.

## Running a release

```bash
docker run -p 8787:8787 -e APP_PASSWORD=choose-one ghcr.io/brandonapol/company-sim:0.2.0
```

Or from the tarball, with Node 22.18 or newer:

```bash
sha256sum -c company-sim_0.2.0_checksums.txt
tar -xzf company-sim_0.2.0.tar.gz && cd company-sim_0.2.0
npm ci --omit=dev
APP_PASSWORD=choose-one node server/index.ts
```

For Kubernetes, point liveness and readiness probes at `/healthz` (no credentials needed), set
`readOnlyRootFilesystem: true` and `runAsNonRoot: true`, and supply `APP_PASSWORD` and any provider keys from
a Secret. The process handles SIGTERM and exits within 10 seconds.

## Yanking a release

When a release ships with a serious bug:

```bash
make release/yank VERSION=v0.2.0
```

This marks the GitHub release as a pre-release so "latest" skips it. The container tag `:0.2.0` stays in the
registry; ship a patch release (`v0.2.1`), which moves `:latest` forward. Do not delete and re-push a tag.

## Re-packaging an old version

Run the **Docker Release** workflow by hand with `version` set (for example `0.1.3`). It builds from that tag
and publishes `:0.1.3` only; `:latest` does not move. Uncheck `push` to build and verify without publishing.

## If a release fails

| Where it failed | What exists            | What to do                                                                     |
| --------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Gate            | Only the tag           | Fix on `main`, then tag the next patch version. Leave the failed tag in place. |
| GitHub release  | Only the tag           | Re-run the failed job from the Actions page.                                   |
| Container       | Tag and GitHub release | Re-run the job, or run **Docker Release** by hand for that version.            |
