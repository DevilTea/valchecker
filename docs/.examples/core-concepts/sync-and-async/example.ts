import { v } from 'valchecker'

export const maybeAsyncSchema = v.string()
	.check(async value => value.length > 0)

export const reachedCallbackResult = maybeAsyncSchema.execute('value')
export const earlyFailureResult = maybeAsyncSchema.execute(42)

export const alwaysAsyncSchema = maybeAsyncSchema.toAsync()
export const alwaysAsyncEarlyFailure = alwaysAsyncSchema.execute(42)
