// @ts-check

/**
 * Mutation testing configuration.
 *
 * Mutation answers a question coverage cannot: would a plausible behavioural change to
 * this code be noticed by the suite? The #134/#135 audit established that it finds real
 * defects reading misses, so it is wired in permanently here rather than run by hand.
 *
 * Two rules this file deliberately encodes:
 *
 * - **The mutation score is not the contract.** `thresholds.break` is null, so a run
 *   never fails on a percentage. Chasing a score rewards killing equivalent mutants,
 *   which means writing tests that assert implementation details. The contract is
 *   enforced by `scripts/check-mutation-survivors.ts` instead: a survivor must either be
 *   killed or carry a written classification.
 * - **The sandbox owns isolation.** `inPlace` stays false, so Stryker mutates a copy
 *   under `tempDirName` and never edits the working tree. The audit lost a day to a
 *   hand-rolled sweep whose live mutation was captured by a broad `git add` over a
 *   shared checkout; no permanent harness may be able to do that.
 */

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	packageManager: 'pnpm',
	// Named explicitly rather than left to the default `@stryker-mutator/*` glob: under
	// pnpm's non-hoisted layout that glob finds no test runner at all.
	plugins: ['@stryker-mutator/vitest-runner'],
	testRunner: 'vitest',
	vitest: {
		configFile: 'vitest.mutation.config.ts',
		// Vitest's `related` mode cannot connect these tests to the mutated files: they
		// import the package barrel, not the implementation module. The full suite runs
		// once for the dry run instead, and `perTest` coverage analysis is what narrows
		// each mutant's test set afterwards, so nothing is measured twice.
		related: false,
	},
	// Runs only the tests that covered the mutated statement. The suite is fast and
	// fully deterministic, which is what makes this safe.
	coverageAnalysis: 'perTest',
	mutate: [
		'packages/*/src/**/*.ts',
		// Tests, benches and the benchmark declaration helper are not production code.
		'!packages/*/src/**/*.test.ts',
		'!packages/*/src/**/*.bench.ts',
		'!packages/internal/src/test-utils/**',
		// Barrels re-export; a mutant in one is either a compile error or unobservable.
		'!packages/*/src/**/index.ts',
	],
	reporters: ['clear-text', 'progress', 'json', 'html'],
	jsonReporter: {
		fileName: 'reports/mutation/mutation.json',
	},
	htmlReporter: {
		fileName: 'reports/mutation/mutation.html',
	},
	clearTextReporter: {
		allowEmojis: false,
		// The survivor list is read from the JSON report by the gate; printing every one
		// again makes CI logs unreadable on a first full sweep.
		maxTestsToLog: 1,
	},
	// Never fail on a percentage — see the note above.
	thresholds: {
		high: 100,
		low: 0,
		break: null,
	},
	incrementalFile: 'reports/mutation/stryker-incremental.json',
	tempDirName: 'node_modules/.stryker-tmp',
	cleanTempDir: true,
	timeoutMS: 30_000,
	// A mutant that makes the suite fail to compile or collect has been detected by the
	// suite; it must never read as a survivor. Stryker reports those as CompileError and
	// RuntimeError, and `check-mutation-survivors.ts` gates on Survived/NoCoverage only.
	disableTypeChecks: 'packages/*/src/**/*.ts',
	warnings: {
		// `@stryker-mutator/vitest-runner` ships no JSON schema, so it contributes no
		// validation for its own `vitest` option and the validator reports that option as
		// unknown on every run. Silencing only this category keeps a genuine
		// misconfiguration visible in the other warning categories.
		unknownOptions: false,
	},
}
