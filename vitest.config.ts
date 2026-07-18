import { defineConfig } from 'vitest/config'
import { coveragePolicy } from './scripts/coverage-policy'

export default defineConfig({
	test: {
		projects: ['packages/*'],
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
