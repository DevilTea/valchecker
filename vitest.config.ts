import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		projects: ['packages/*'],
		coverage: {
			enabled: true,
			exclude: [
				'**/*.config.*',
				'**/index.*',
				'**/docs/**',
				'**/scripts/**',
				'**/dist/**',
				'**/coverage/**',
			],
		},
		typecheck: {
			enabled: true,
		},
	},
})
