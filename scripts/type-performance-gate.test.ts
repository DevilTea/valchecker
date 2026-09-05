import type { TypePerformanceMetrics } from './type-performance-gate'
import { describe, expect, it } from 'vitest'
import { evaluateTypePerformance } from './type-performance-gate'

const metrics: TypePerformanceMetrics = {
	files: 1,
	types: 10,
	instantiations: 20,
	memoryKib: 30,
	checkSeconds: 1,
	totalSeconds: 2,
}

describe('type-performance baseline gate', () => {
	it('fails when the committed budget is missing', () => {
		expect(evaluateTypePerformance(metrics, undefined, '5.9.3'))
			.toEqual(['No committed type-performance budget exists. Commit type-performance/budget.json before treating this gate as passed.'])
	})

	it('passes an unchanged reviewed baseline', () => {
		expect(evaluateTypePerformance(metrics, {
			typescript: '5.9.3',
			maximum: { types: 10, instantiations: 20, memoryKib: 30 },
		}, '5.9.3'))
			.toEqual([])
	})

	it('reports metric and compiler-version drift', () => {
		expect(evaluateTypePerformance(metrics, {
			typescript: '5.8.0',
			maximum: { types: 9, instantiations: 20, memoryKib: 29 },
		}, '5.9.3'))
			.toEqual([
				'budget targets TypeScript 5.8.0, but the workspace uses 5.9.3',
				'types 10 exceeds 9',
				'memoryKib 30 exceeds 29',
			])
	})
})
