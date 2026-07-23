import type { OverloadParametersAndReturnType, OverloadReturnType } from './shared'
import { describe, expectTypeOf, it } from 'vitest'

// Sentinel for the overload ladders (see the WARNING on their definitions). The
// ladders support up to 8 overloads; exceeding that silently drops the first
// overload with no compile error. The highest step variant count is toFiltered's
// 4 overloads, leaving 4 slots of headroom. These assertions fail at typecheck if
// the ladder is ever shortened below what a step relies on.

interface Fn4 {
	(a: 1): 'r1'
	(a: 2): 'r2'
	(a: 3): 'r3'
	(a: 4): 'r4'
}

interface Fn8 {
	(a: 1): 'r1'
	(a: 2): 'r2'
	(a: 3): 'r3'
	(a: 4): 'r4'
	(a: 5): 'r5'
	(a: 6): 'r6'
	(a: 7): 'r7'
	(a: 8): 'r8'
}

describe('overload ladder sentinels', () => {
	it('captures every overload of a 4-variant function (current max: toFiltered)', () => {
		expectTypeOf<OverloadParametersAndReturnType<Fn4>>()
			.toEqualTypeOf<
				| [[1], 'r1']
				| [[2], 'r2']
				| [[3], 'r3']
				| [[4], 'r4']
		>()
		expectTypeOf<OverloadReturnType<Fn4>>()
			.toEqualTypeOf<'r1' | 'r2' | 'r3' | 'r4'>()
	})

	it('captures all 8 overloads at the ladder limit without dropping the first', () => {
		expectTypeOf<OverloadParametersAndReturnType<Fn8>>()
			.toEqualTypeOf<
				| [[1], 'r1']
				| [[2], 'r2']
				| [[3], 'r3']
				| [[4], 'r4']
				| [[5], 'r5']
				| [[6], 'r6']
				| [[7], 'r7']
				| [[8], 'r8']
		>()
		expectTypeOf<OverloadReturnType<Fn8>>()
			.toEqualTypeOf<
			'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8'
		>()
	})
})
