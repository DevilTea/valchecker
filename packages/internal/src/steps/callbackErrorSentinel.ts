/**
 * Shared callback-error sentinel for the native array fast paths used by
 * `toFiltered`, `toMapped`, and `toSorted`.
 *
 * Those steps delegate to the engine's native `Array.prototype.filter`/`map`/
 * `toSorted`, which cannot surface a structured step failure. A throwing user
 * callback is therefore wrapped in this sentinel and rethrown out of the native
 * method; the outer runner catches the sentinel, converts the captured context
 * into a step issue, and rethrows anything that is not a sentinel unchanged so
 * genuine engine failures still reach the core boundary.
 */
export class CallbackErrorSentinel<Context> {
	constructor(
		readonly context: Context,
		readonly error: unknown,
	) { }
}

/**
 * Runs a native-array body that may throw a `CallbackErrorSentinel`. Sentinel
 * errors are converted via `onCallbackError`; any other error is rethrown so
 * the core execution boundary handles it.
 */
export function runWithCallbackErrorSentinel<Ok, Fail, Context>(
	body: () => Ok,
	onCallbackError: (context: Context, error: unknown) => Fail,
): Ok | Fail {
	try {
		return body()
	}
	catch (error) {
		if (error instanceof CallbackErrorSentinel)
			return onCallbackError(error.context as Context, error.error)
		throw error
	}
}
