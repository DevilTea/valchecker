# Releasing Valchecker

Valchecker publishes three public packages as one lockstep release unit:

1. `@valchecker/internal`
2. `@valchecker/all-steps`
3. `valchecker`

The repository root and all three publishable package manifests always carry the same version. Publication is authorized by an **annotated Git tag**, not by a mutable repository state file or typed workflow inputs.

## Source of truth

Each part of a release has one authority:

- next release contents: `CHANGELOG.md` under `## [Unreleased]`;
- version being prepared: the four lockstep workspace manifests in the release pull request;
- candidate quality: required pull-request CI;
- authorization to publish: annotated Git tag `vX.Y.Z`;
- npm channel: derived from semver (`*-rc.N` → `next`, stable → `latest`);
- publication reality: the npm registry;
- released source revision: the commit the annotated tag points to.

The tag is intentionally created **after** the release pull request has merged. A branch, pull request, merge, or manifest version alone does not publish anything.

## npm trusted publisher configuration

Configure an npm trusted publisher for each of the three packages. All three point at:

- repository: `DevilTea/valchecker`;
- workflow: `.github/workflows/release.yml`;
- GitHub environment: `npm`.

The publish job runs on a GitHub-hosted runner, requests `id-token: write`, and uses npm Trusted Publishing/OIDC. Do not configure `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or another long-lived npm credential for this workflow.

The workflow deliberately does not pass `registry-url` to `actions/setup-node`: that option exports a `NODE_AUTH_TOKEN` placeholder, while this release path accepts only OIDC. npm 11.5.1 or newer is required and the workflow installs that version before publication.

The `npm` GitHub environment exists to supply the OIDC environment claim expected by npm. It does not need a deployment URL or a long-lived secret.

## Security audit policy

Release preparation and publication run `pnpm security:audit` before any tarball is prepared or published. The policy runs both the full and production-only pnpm audits and evaluates exposure rather than trusting the `devDependency` label:

- production/consumer advisories at `moderate` or above block the release;
- advisories reachable through the release/security-sensitive npm tool roots (`@clack/prompts`, `bumpp`, `tsx`, `zx`) block even though those packages are development tools;
- other development-tool advisories must match a bounded record in `security-audit-acknowledgements.json`;
- an acknowledgement is valid only while severity stays at or below its ceiling, every observed direct root stays inside its allowed roots, and its review date has not expired;
- a new advisory, widened exposure, severity increase, expired acknowledgement, or stale acknowledgement is a hard failure.

Acknowledgements are visible debt, not a suppression list. Each record states the GHSA identity, affected dependency, exposure rationale, remediation blocker, acknowledgement/expiry dates, and review condition. The weekly `security-audit` workflow writes the full machine-readable evaluation to `artifacts/security-audit/report.json` and uploads it even when the policy blocks.

## Preparing a release pull request

Start from a clean, synchronized local `main` with an authenticated GitHub CLI:

```bash
pnpm release <release>
```

`<release>` is any release selector accepted by `bumpp`, including an exact version. Examples:

```bash
pnpm release patch
pnpm release 1.0.0-rc.0
pnpm release 1.0.0
```

The command fails unless local `main` exactly matches `origin/main`. It then:

1. bumps the root and all three publishable manifests together;
2. updates the lockfile;
3. moves the current `[Unreleased]` changelog contents under a dated version heading and leaves a fresh `[Unreleased]` section above it;
4. verifies the four manifests are still version-lockstep;
5. refuses an existing local/remote release tag or release branch;
6. asks for confirmation;
7. creates `release/vX.Y.Z`, commits and pushes the release candidate;
8. opens a release pull request and enables squash auto-merge.

Required CI validates that pull request exactly like any other candidate. In particular, `Release-Artifacts` builds and inspects the three immutable tarballs, verifies workspace dependency rewriting, and runs the publish preflight in verify-only mode.

If required CI fails, fix the release pull request. Do not tag around a red candidate.

## Authorizing publication with an annotated tag

After the release pull request has merged, return to a clean worktree and run:

```bash
pnpm release:tag
```

The command fetches `origin/main` and tags, switches to `main`, fast-forwards it with `--ff-only`, and rechecks the lockstep version and changelog. It refuses a tag that already exists locally or remotely, shows the exact `main` commit, and asks for explicit confirmation before running the equivalent of:

```bash
git tag --annotate vX.Y.Z --message vX.Y.Z
git push origin vX.Y.Z
```

Pushing that annotated tag is the publication authorization. There is no second version/tag prompt in GitHub Actions.

## What the publish workflow proves

A `v*` tag starts `.github/workflows/release.yml`. Before publishing, the workflow and release scripts verify all of the following:

- the ref is an annotated tag object, not a lightweight tag;
- peeling the tag yields exactly `GITHUB_SHA`;
- the tagged commit is an ancestor of `origin/main`;
- the tag is exactly `v<workspace version>`;
- root, `@valchecker/internal`, `@valchecker/all-steps`, and `valchecker` remain version-lockstep;
- the first dated changelog release heading is that same version;
- prerelease versions end in `-rc.N` and use npm `next`; stable versions use `latest`;
- `pnpm release:validate` passes on the tagged source;
- freshly packed tarballs contain the expected files and no source/tests/benchmarks/TypeScript config;
- packed workspace dependencies have been rewritten to the exact release version;
- tarball size, SHA-256 checksum, and SHA-512 npm integrity match the release manifest immediately before publication;
- no long-lived npm token is present.

The exact tarballs verified above are uploaded as a workflow artifact before npm publication.

## Publication order and partial release recovery

Packages publish in dependency order:

1. `@valchecker/internal`
2. `@valchecker/all-steps`
3. `valchecker`

A workflow rerun after a partial release is safe. Before publishing any new tarball, the script preflights all three package versions against npm and builds a complete publication plan. No package is published until every existing version has passed the integrity check.

- If a version does not exist, that verified tarball is planned for publication.
- If it exists and npm's `dist.integrity` exactly matches this release tarball's SHA-512 integrity, that package is planned to be skipped.
- If any existing version has different integrity, the whole publication stops before the first publish call. An existing version is never assumed to be the intended artifact just because its version string matches.

This is the only supported recovery path for a partial release: rerun the workflow for the same annotated tag. Do not publish a missing package manually with a local token, and never try to overwrite or reuse a conflicting npm version.

## npm distribution tags

The normal release path does not accept a hand-entered npm tag.

- `X.Y.Z-rc.N` publishes to `next`.
- `X.Y.Z` publishes to `latest`.
- Other prerelease labels are rejected by the release contract.

A stable release publishes new stable-version tarballs; it does not retag an RC artifact as stable.

## Post-publish verification

After the workflow succeeds:

1. verify all three exact versions are visible on npm;
2. verify the stable/prerelease dist-tag points at the intended version;
3. inspect npm provenance for every package;
4. confirm package manifests on npm contain exact internal dependency versions;
5. create the matching GitHub Release from the existing `vX.Y.Z` tag if desired.

No follow-up repository state transition is required. Development continues by adding entries to the already-present `[Unreleased]` section.

## Release failure rules

- Never move or recreate a release tag to change its source commit.
- Never reuse a version whose npm artifact conflicts with the intended tarball.
- Never bypass required release CI by publishing locally.
- Never add a long-lived npm token to the release workflow.
- For a partial release, rerun the same tag workflow so the artifact-integrity check decides which packages may be skipped.
- If a release needs corrected source, prepare a new patch or RC version through a new release pull request and annotated tag.
