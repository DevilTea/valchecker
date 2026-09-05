import type { ApiSurface } from './check-api-surface'
import { describe, expect, it } from 'vitest'
import { apiSurfaceDifferences } from './check-api-surface'

function surface(signature: string): ApiSurface {
	const packageSurface = {
		runtime: ['example'],
		declaredValues: ['example'],
		typeOnly: [],
		declarationSignatures: { example: signature },
	}
	return {
		'@valchecker/internal': packageSurface,
		'@valchecker/all-steps': packageSurface,
		'valchecker': packageSurface,
	}
}

describe('public declaration API snapshot', () => {
	it('accepts unchanged output', () => {
		expect(apiSurfaceDifferences(surface('example: (value: string) => number'), surface('example: (value: string) => number')))
			.toEqual([])
	})

	it('rejects a signature-only change with the same export name', () => {
		expect(apiSurfaceDifferences(surface('example: (value: string) => number'), surface('example: (value: number) => number')))
			.toContain('@valchecker/internal declaration signature changed for \'example\'')
	})
})
