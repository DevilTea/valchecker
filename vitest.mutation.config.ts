import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration used only by the mutation runner.
 *
 * It deliberately does not reuse the root config. The root config declares
 * `projects` and enables `typecheck`; under mutation both are pure overhead, because
 * a runtime mutant cannot be killed by a type assertion and the `scripts` project
 * never executes the code being mutated. Running one flat project also keeps the
 * per-mutant startup cost to a single Vite server.
 */
export default defineConfig({
	test: {
		include: ['packages/*/src/**/*.test.ts'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		typecheck: {
			enabled: false,
		},
		coverage: {
			enabled: false,
		},
	},
})
