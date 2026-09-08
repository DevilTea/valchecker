import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const valcheckerEntry = fileURLToPath(new URL('../packages/valchecker/dist/index.mjs', import.meta.url))
const internalEntry = fileURLToPath(new URL('../packages/internal/dist/index.mjs', import.meta.url))
const allStepsEntry = fileURLToPath(new URL('../packages/all-steps/dist/index.mjs', import.meta.url))

export default defineConfig({
	root: import.meta.dirname,
	resolve: {
		alias: {
			'valchecker': valcheckerEntry,
			'@valchecker/internal': internalEntry,
			'@valchecker/all-steps': allStepsEntry,
		},
	},
	test: {
		include: ['.examples/**/*.test.ts'],
	},
})
