import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'@valchecker/internal': path.resolve(__dirname, '../packages/internal/src/index.ts'),
		},
	},
	test: {
		benchmark: {
			include: ['**/*.bench.ts'],
		},
	},
})
