import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(new URL('../.github/workflows/bundle-size-impact.yml', import.meta.url), 'utf8')
const harness = readFileSync(new URL('../benchmarks/src/treeshake.mjs', import.meta.url), 'utf8')

describe('bundle Size Impact wiring', () => {
	it('measures a built base artifact against the candidate and blocks meaningful regressions', () => {
		expect(workflow)
			.toContain('path: .bundle-base')
		expect(workflow)
			.toContain('pnpm --dir .bundle-base build')
		expect(workflow)
			.toContain('--base-root ../.bundle-base')
		expect(workflow)
			.toContain('--candidate-root ..')
		expect(workflow)
			.toContain('--fail-on-regression')
	})

	it('the primary consumer profile does not reintroduce the aggressive assumptions D15 rejected', () => {
		expect(harness).not.toContain('moduleSideEffects: false')
		expect(harness).not.toContain('propertyReadSideEffects: false')
		expect(harness).not.toContain('pure_getters: true')
		expect(harness)
			.toContain('name: \'packed-consumer\'')
		expect(harness)
			.toContain('packageSideEffects: \'manifest\'')
	})
})
