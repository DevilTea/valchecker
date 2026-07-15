# Releasing Valchecker

Valchecker publishes three public packages from immutable tarballs prepared by CI:

1. `@valchecker/internal`
2. `@valchecker/all-steps`
3. `valchecker`

Publishing is intentionally separated from version changes. The publish workflow never edits files, creates commits, pushes tags, or creates GitHub releases.

## Release plan

The active candidate is defined in `release-plan.json`. It records:

- the exact version,
- the npm distribution tag,
- the release channel,
- the ordered package list,
- external publishing prerequisites,
- `publish: false` to assert that repository state never authorizes publication.

The separate, manually dispatched and environment-approved npm workflow is the publication authorization. A pull request, merge, tag, or value committed to `release-plan.json` must never publish a package by itself.

`pnpm release:readiness` validates this plan against package manifests, changelog, migration/support/releasing documents, and workflow safety properties.

## npm trusted publisher configuration

Configure a trusted publisher separately for all three npm packages.

Use these exact values:

| Setting | Value |
| --- | --- |
| Organization or user | `DevilTea` |
| Repository | `valchecker` |
| Workflow filename | `release.yml` |
| GitHub environment | `npm` |
| Allowed actions | `npm publish` |

The GitHub workflow is `.github/workflows/release.yml`. It runs only on a GitHub-hosted Ubuntu runner and requests `id-token: write` only for the publish job.

Do not configure `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or another long-lived npm credential. `scripts/publish-release.ts` rejects token-based publishing.

Trusted publishing currently requires npm 11.5.1 or newer. The workflow installs and verifies that npm version before publishing.

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

## RC readiness checklist

Before publishing a release candidate, all items must be true:

- [ ] The version and npm tag in `release-plan.json` are correct.
- [ ] Root and all three publishable package manifests have the same version.
- [ ] `CHANGELOG.md` has an `Unreleased` entry for the exact version.
- [ ] `MIGRATION.md` documents every known pre-1.0 breaking change.
- [ ] `SUPPORT.md` defines runtime, semver, prerelease, deprecation, and security policies.
- [ ] The 1.0 contract and API documentation build successfully.
- [ ] Public runtime and declaration exports match `api-surface.json`.
- [ ] Package tarball consumer fixtures pass for ESM, dynamic import, `NodeNext`, and `Bundler`.
- [ ] Coverage, benchmark smoke, Node 22/24, and Ubuntu/macOS/Windows jobs are green.
- [ ] `Release-Artifacts` prepares and verifies exact tarball sizes and SHA-256 checksums.
- [ ] The `npm` GitHub environment is protected and restricted to `main`.
- [ ] npm trusted publishers are configured for all three packages with the exact workflow and environment.
- [ ] The final `main` commit is the commit intended for publication.

The repository can verify the code-controlled items with:

```bash
pnpm release:readiness
pnpm release:validate
pnpm release:prepare
```

The GitHub environment and npm trusted publisher settings are external controls and must be checked in their respective UIs.

## Validation commands

Run the complete release validation without publishing:

```bash
pnpm install --frozen-lockfile
pnpm release:validate
pnpm release:prepare
```

`release:validate` runs:

- release-plan and governance readiness checks,
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

## Post-publish verification

After npm publication succeeds:

1. Verify all three exact versions exist on npm.
2. Verify prereleases are attached to `next` and stable releases to `latest`.
3. Inspect npm provenance for every package.
4. Install `valchecker@<version>` into a clean temporary project.
5. Repeat an ESM import and a TypeScript `NodeNext` compile outside the monorepo.
6. Confirm the published package manifests contain exact internal dependency versions.
7. Only then create the matching Git tag and GitHub release.

The tag must be exactly:

```text
v<version>
```

The GitHub release body must be derived from the matching `CHANGELOG.md` section and link to `MIGRATION.md` for a major or prerelease transition. Do not mark an RC as the latest stable release.

Tag and GitHub release creation are deliberate post-publication actions. They are not performed by `.github/workflows/release.yml`.

## Stable promotion

Do not move the npm `latest` tag to an RC.

Promoting an RC to stable requires a new reviewed pull request that:

- changes every manifest and `release-plan.json` to `1.0.0`,
- changes the npm tag to `latest`,
- converts the changelog entry from `Unreleased` to the publication date,
- records RC feedback and fixes,
- reruns every readiness and release-artifact gate.

Stable promotion publishes new `1.0.0` tarballs; it does not retag or rename `1.0.0-rc.*` artifacts.

## Failure behavior

Publishing stops on the first failed package. npm does not support atomic multi-package publication, so a partial release is possible if npm accepts one package and a later publication fails.

Recovery rules:

- never reuse or overwrite an already-published version,
- inspect which package versions exist on npm,
- fix the cause in a pull request,
- publish a new patch or prerelease version,
- do not manually publish missing packages with a local token.

Do not create a Git tag or GitHub release for a partial release.

## Explicit non-actions

The release workflow does not:

- bump versions,
- modify the working tree,
- commit or push,
- create or push Git tags,
- generate a GitHub release,
- download and execute an unpinned release-note tool,
- publish on `push`, `pull_request`, or tag creation.

The RC preparation pull request also does not publish, tag, or dispatch the npm workflow. Publication requires a separate explicit action after all external prerequisites are confirmed.
