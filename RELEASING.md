# Releasing Valchecker

Valchecker publishes three public packages from immutable tarballs prepared by CI:

1. `@valchecker/internal`
2. `@valchecker/all-steps`
3. `valchecker`

Publishing is intentionally separated from version changes. The publish workflow never edits files, creates commits, pushes tags, or creates GitHub releases.

## npm trusted publisher configuration

Configure a trusted publisher separately for all three npm packages.

Use these exact values:

| Setting | Value |
| --- | --- |
| Organization or user | `DevilTea` |
| Repository | `valchecker` |
| Workflow filename | `release.yml` |
| GitHub environment | `npm` |

The GitHub workflow is `.github/workflows/release.yml`. It runs only on a GitHub-hosted Ubuntu runner and requests `id-token: write` only for the publish job.

Do not configure `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or another long-lived npm credential. `scripts/publish-release.ts` rejects token-based publishing.

Trusted publishing currently requires npm 11.5.1 or newer. The workflow checks the installed npm version before publishing.

Official references:

- https://docs.npmjs.com/trusted-publishers/
- https://docs.npmjs.com/generating-provenance-statements/
- https://docs.github.com/en/actions/concepts/security/openid-connect

## GitHub environment

Create a GitHub Actions environment named `npm`.

Recommended protection:

- require a manual reviewer,
- restrict deployment branches to `main`,
- do not store an npm token in the environment,
- limit administrators bypassing environment protection.

The environment name must match the trusted publisher configuration on npm.

## Version preparation

Version changes must be made in a normal pull request. Keep these versions identical:

- root `package.json`,
- `packages/internal/package.json`,
- `packages/all-steps/package.json`,
- `packages/valchecker/package.json`.

Do not publish from an unmerged branch. The publish workflow rejects refs other than `refs/heads/main` and requires the requested version to match the prepared release manifest.

Prerelease versions use semver prerelease syntax, for example:

```text
1.0.0-rc.0
```

Prereleases must use the npm `next` tag. Stable versions must use `latest`.

## Validation commands

Run the complete release validation without publishing:

```bash
pnpm install --frozen-lockfile
pnpm release:validate
pnpm release:prepare
```

`release:validate` runs:

- package builds,
- public API surface verification,
- `publint`,
- installed-tarball consumer tests,
- lint,
- typechecking,
- coverage gates,
- documentation build.

`release:prepare` then:

- validates every source package manifest,
- requires all package versions to match,
- requires ESM-only exports and Node.js 22+,
- packs packages in dependency order,
- inspects actual tarball manifests,
- verifies `workspace:*` dependencies were replaced by the release version,
- rejects source, test, benchmark, TypeScript config, or `node_modules` files in tarballs,
- verifies runtime and declaration entrypoints are present,
- records tarball size and SHA-256 in `artifacts/release/release-manifest.json`.

CI runs `release:prepare` for every pull request and uploads the resulting tarballs for inspection. These CI artifacts are not published automatically.

## Manual publish workflow

After the version pull request is merged and all main-branch checks pass:

1. Open **Actions → Publish to npm**.
2. Run the workflow from `main`.
3. Enter the exact committed version.
4. Choose `next` for a prerelease or `latest` for a stable release.
5. Enter the exact confirmation text:

```text
publish <version> to <tag>
```

Example:

```text
publish 1.0.0-rc.0 to next
```

6. Approve the `npm` environment deployment.

The workflow reruns the complete release validation, prepares fresh tarballs from the checked-out commit, uploads them for audit, verifies their checksums, and publishes those exact tarballs sequentially.

Automatic npm provenance is supplied by trusted publishing for the public GitHub repository and packages. The workflow does not pass a separate provenance flag.

## Failure behavior

Publishing stops on the first failed package. npm does not support atomic multi-package publication, so a partial release is possible if npm accepts one package and a later publication fails.

Recovery rules:

- never reuse or overwrite an already-published version,
- inspect which package versions exist on npm,
- fix the cause in a pull request,
- publish a new patch or prerelease version,
- do not manually publish missing packages with a local token.

## Explicit non-actions

The release workflow does not:

- bump versions,
- modify the working tree,
- commit or push,
- create or push Git tags,
- generate a GitHub release,
- download and execute an unpinned release-note tool,
- publish on `push`, `pull_request`, or tag creation.

Tagging, release notes, changelog governance, and RC promotion are defined separately from npm package publication.
