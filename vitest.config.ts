import { defineConfig } from 'vitest/config'
import { coveragePolicy } from './scripts/coverage-policy'

export default defineConfig({
	test: {
		projects: ['packages/*', 'scripts'],
		coverage: {
			enabled: false,
			provider: 'v8',
			include: [
				'packages/*/src/**/*.ts',
			],
			exclude: [
				'**/*.config.*',
				'**/index.*',
				'**/docs/**',
				'**/scripts/**',
				'**/dist/**',
				'**/coverage/**',
				'**/*.bench.*',
				'**/*.test.*',
				// The step-benchmark declaration helper. It is excluded for the same reason
				// `**/*.bench.*` is — nothing ships it and no test executes it — but it needs
				// naming separately because it is the one piece of that harness that is not
				// itself a `.bench.ts`. Its own validation is not unchecked: every
				// `stepBench()` declaration in the repository runs through it on `pnpm bench`
				// and again on `pnpm bench:cells`, which is a wider exercise than a unit test
				// of it would be.
				'**/test-utils/step-bench.ts',
			],
			reporter: [
				['text', { skipFull: true }],
				'text-summary',
				'json',
				'json-summary',
				'lcov',
				'html',
			],
			reportOnFailure: true,
			thresholds: coveragePolicy.global,
		},
		typecheck: {
			enabled: true,
		},
		benchmark: {
			include: ['**/*.bench.ts'],
			exclude: ['**/node_modules/**', '**/dist/**'],
		},
	},
})
