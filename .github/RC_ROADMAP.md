# Valchecker 1.0 RC roadmap

This document tracks the ordered pull requests required before publishing the first 1.0 release candidate.

## Ordered pull requests

1. **ESM-only packaging and Node.js support contract**
   - Publish ESM only from every package.
   - Remove CommonJS exports and artifacts.
   - Standardize the supported runtime on Node.js 22+.
   - Update package scaffolding and immediate compatibility documentation.

2. **Published-package smoke tests**
   - Build and pack every public package.
   - Run `publint`.
   - Install tarballs into clean ESM, CommonJS dynamic-import, TypeScript NodeNext, and TypeScript Bundler fixtures.
   - Verify public and selective imports from the actual artifacts.

3. **Coverage gates and missing regression tests**
   - Include all production source files in coverage.
   - Enforce global thresholds: 95% lines/statements/functions and 92% branches.
   - Enforce per-file and critical-core minimums.
   - Add tests required to make the gates meaningful and green.

4. **Standard Schema and execution-contract compliance**
   - Add integration fixtures for sync, maybe-async, async, transformed output, failures, paths, and native Promise behavior.
   - Verify compatibility through a consumer-facing adapter test.

5. **Public API and export-surface freeze**
   - Snapshot and audit all public runtime and type exports.
   - Define the supported plugin-author surface.
   - Prevent accidental exports and clarify the role of `@valchecker/internal`.

6. **Cross-library benchmark suite**
   - Compare Valchecker, Zod 3, Zod 4 JIT, Zod 4 jitless, and Valibot.
   - Separate schema construction, cold first execution, and warm validation.
   - Cover primitive pipelines, flat/nested objects, arrays, unions, transforms, and optional-heavy objects.
   - Pin all compared package versions exactly and verify adapter correctness before timing.

7. **Manual benchmark workflow and reports**
   - Add smoke, standard, and full `workflow_dispatch` modes.
   - Publish summaries to the Actions run summary.
   - Upload raw JSON, Markdown, HTML, and environment metadata artifacts.
   - Support publishing approved main-branch results for the documentation site.

8. **1.0 contract documentation**
   - Document ESM-only usage, Node.js support, sync/maybe-async/async execution, unions, intersections, object modes, messages, and plugins.
   - Correct issue codes, bundle-size claims, and all examples against the final API.

9. **Release pipeline hardening**
   - Require tests, coverage, typecheck, build, docs build, publint, pack, and artifact smoke tests.
   - Use trusted publishing and provenance.
   - Prevent partial releases and support a non-publishing validation mode.

10. **1.0 migration and release governance**
    - Add changelog, migration guide, support policy, semver/deprecation policy, security reporting, and release checklist.
    - Complete RC readiness verification without publishing the 1.0 RC.

## Stop condition

Stop after all readiness work is merged and the release-candidate validation is green. Do not publish or tag `1.0.0-rc.*` without an explicit follow-up request.
