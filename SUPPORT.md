# Valchecker Support Policy

This policy applies to the Valchecker 1.0 release line and its release candidates.

## Supported runtime

| Component | Supported |
| --- | --- |
| Node.js | 22 or newer |
| Module format | ESM |
| CommonJS | Dynamic `import()` only |
| TypeScript resolution tested in package fixtures | `NodeNext`, `Bundler` |
| Standard Schema | V1 |

A Node.js release may be removed from support only in a new Valchecker major version unless continued support becomes impossible because of a critical security or ecosystem constraint.

Valchecker does not guarantee behavior on end-of-life Node.js releases, alternative JavaScript runtimes, transpiled CommonJS output, or package-private import paths unless explicitly documented.

## Package support boundaries

### `valchecker`

Supported for application schemas and normal consumers.

### `@valchecker/all-steps`

Supported for assembling custom Valchecker instances.

### `@valchecker/internal`

The package name is historical. Root exports recorded in `api-surface.json` are semver-covered and supported for advanced types and step-plugin authors.

The following are not supported API:

- files below package-private source paths,
- unexported implementation helpers,
- generated build internals,
- runtime marker symbols not present in the public export manifest.

## Semantic Versioning

Valchecker follows Semantic Versioning after `1.0.0`.

### Patch release

May include:

- bug fixes that restore documented behavior,
- security fixes,
- performance improvements without contract changes,
- documentation and tooling fixes,
- additional regression tests.

A patch may change behavior that contradicts the 1.0 contract when the previous behavior is treated as a bug. Such fixes must be documented when they could affect consumers.

### Minor release

May include:

- backward-compatible validators, transforms, helpers, and types,
- new issue codes for newly added features,
- opt-in behavior,
- additive plugin-author capabilities.

### Major release

Required for:

- removing or renaming a semver-covered export,
- changing accepted inputs or transformed outputs incompatibly,
- changing result or issue shapes incompatibly,
- changing object, union, intersection, async, or plugin semantics incompatibly,
- raising the minimum Node.js version outside the stated policy,
- removing a supported module-resolution path.

## Release candidates

Versions such as `1.0.0-rc.0` are prereleases and use the npm `next` tag.

Release candidates:

- are intended for integration testing,
- may receive incompatible corrections before stable `1.0.0`,
- are not installed by the npm `latest` tag,
- must not be promoted to stable without a reviewed version/changelog pull request,
- must pass the same package, coverage, documentation, benchmark-smoke, and release-artifact gates as a stable release.

An RC issue should identify the exact prerelease version. Fixes are released as a new prerelease identifier; an existing npm version is never overwritten.

## Deprecation policy

A supported API targeted for removal should normally be:

1. documented as deprecated,
2. marked with TypeScript `@deprecated` where applicable,
3. given a supported replacement,
4. retained for at least one minor release before removal in the next major release.

Immediate removal without a deprecation period is reserved for severe security problems, accidental exposure that has not shipped in a stable release, or behavior that cannot be retained safely.

Deprecation warnings must not silently alter validation results.

## Security fixes

Security issues take priority over the normal release cadence. A security fix may:

- be released as an expedited patch,
- disable unsafe behavior when no compatible mitigation exists,
- require an out-of-band minimum runtime change when mandated by an upstream vulnerability.

Public vulnerability reports should avoid including exploit details before a fix is available. Use GitHub's private vulnerability reporting feature when enabled for the repository. Otherwise contact the maintainer privately before opening a public issue.

The npm release workflow uses OIDC trusted publishing and rejects long-lived npm tokens. Release artifacts are checksum-verified before publication.

## Bug reports

A useful report includes:

- exact Valchecker package and version,
- Node.js version,
- TypeScript version and module resolution when relevant,
- operating system,
- minimal schema and input,
- actual result or issue payload,
- expected behavior and the contract section supporting it,
- whether execution used `execute()` or `~standard`.

Use GitHub issues for reproducible bugs and feature requests.

## Compatibility disputes

When implementation, tests, type declarations, and documentation disagree:

1. treat the discrepancy as a bug,
2. identify the intended contract explicitly,
3. add a regression test,
4. update all affected documentation and declarations,
5. classify the release according to the resulting compatibility impact.

Undocumented implementation behavior is not automatically promoted to public API.
