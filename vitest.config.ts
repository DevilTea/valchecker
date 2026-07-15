import { defineConfig } from 'vitest/config'

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
			thresholds: {
				lines: 95,
				statements: 95,
				functions: 95,
				branches: 92,
				'packages/internal/src/core/**/*.ts': {
					lines: 100,
					statements: 100,
					functions: 100,
					branches: 95,
				},
				'packages/internal/src/steps/{union,intersection,object,strictObject,looseObject,use}/**/*.ts': {
					lines: 90,
					statements: 90,
					functions: 95,
					branches: 85,
				},
			},
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
