import type { MaybePromise } from '../shared'

/**
 * Unwraps the synchronous branch of a `maybe-async`-typed execution result.
 *
 * A schema that contains a callback step (`transform`, `fallback`, `check`, …)
 * is conservatively typed `maybe-async`, so `execute` returns `MaybePromise<…>`.
 * Tests that only exercise synchronous callbacks always receive the synchronous
 * branch at runtime; this preserves the precise result type while dropping the
 * unreachable promise branch.
 */
export function syncResult<T>(result: MaybePromise<T>): T {
	return result as T
}
