import { describe, expect, it } from 'vitest'
import {
	alwaysAsyncEarlyFailure,
	earlyFailureResult,
	reachedCallbackResult,
} from './example'

describe('sync and async documentation example', () => {
	it('returns a promise when execution reaches an async callback', () => {
		expect(reachedCallbackResult)
			.toBeInstanceOf(Promise)
	})

	it('can fail synchronously before the async callback is reached', () => {
		expect(earlyFailureResult)
			.not.toBeInstanceOf(Promise)
		expect(earlyFailureResult)
			.toHaveProperty('issues')
	})

	it('returns a native promise for every call after toAsync()', async () => {
		expect(alwaysAsyncEarlyFailure)
			.toBeInstanceOf(Promise)
		await expect(alwaysAsyncEarlyFailure)
			.resolves.toHaveProperty('issues')
	})
})
