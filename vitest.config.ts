import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		projects: ['packages/*', 'benchmarks'],
		coverage: {
			enabled: true,
			exclude: [
				'**/*.config.*',
				'**/index.*',
				'**/docs/**',
				'**/scripts/**',
				'**/dist/**',
				'**/coverage/**',
				'**/benchmarks/**',
			],
		},
		typecheck: {
			enabled: true,
		},
	},
})
