---
description: Put database or API checks behind a Valchecker pipeline without confusing service failures with schema execution semantics.
relatedSources:
  - packages/internal/src/core/core.ts
  - packages/internal/src/steps/check/check.ts
---
# Async Validation

Use asynchronous validation when a value is structurally valid but its acceptability depends on an external service, database, cache, or policy boundary.

This page focuses on the application pattern. For the exact direct-vs-promise execution contract, read [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async).

## Normalize before the external check

Put cheap deterministic work before network or database work so the external service receives the same canonical value your application will use.

<<< ../.examples/guides-recipes/async-validation/example.ts

The checked fixture proves that an input such as `"  Alice  "` reaches the directory as `"alice"`, and that a taken username becomes an ordinary validation issue.

Exact callback return forms and callback-failure behavior belong to [`check()`](/api/helpers#check).

## Parallelize independent work inside one callback

If several remote checks are independent, parallelize them at the service boundary rather than adding serial schema callbacks purely for readability:

```ts
import { v } from 'valchecker'

interface EmailPolicy {
	isDisposable: (email: string) => Promise<boolean>
	isBannedDomain: (email: string) => Promise<boolean>
}

function createEmailSchema(policy: EmailPolicy) {
	return v.string()
		.toLowercase()
		.toTrimmed()
		.check(async (value) => {
			const [disposable, banned] = await Promise.all([
				policy.isDisposable(value),
				policy.isBannedDomain(value),
			])

			if (disposable)
				return 'Disposable email addresses are not allowed'
			if (banned)
				return 'This email domain is not allowed'
			return true
		})
}
```

Use separate schema steps when the checks have meaningful ordering, different recovery boundaries, or reusable named semantics.

## Decide what infrastructure failure means

A failed business rule and a failed dependency are different events. Decide that policy explicitly before writing the callback.

| Situation | Typical boundary |
| --- | --- |
| Service answered and the value is not allowed | Return a validation failure from the callback. |
| Service is unavailable and the request must stop | Let the application/service boundary surface the outage according to your error policy. |
| Service is unavailable but a documented degraded mode exists | Apply that fallback outside or inside the schema only when the degraded behavior is intentional and observable. |

Do not silently convert every timeout or database outage into “invalid input.” That makes operational failures indistinguishable from user mistakes.

## Keep validation checks idempotent

Validation may be retried, invoked during previews, or run before a later write. Prefer reads and policy checks inside validation callbacks. Avoid making an irreversible write the only way a value becomes “validated.”

This matters most for uniqueness checks: preflight validation improves feedback, but it does not replace a database uniqueness constraint or a transactional re-check at write time.

```ts
interface Users {
	exists: (username: string) => Promise<boolean>
	create: (username: string) => Promise<void>
}

async function createUser(users: Users, username: string) {
	if (await users.exists(username))
		throw new Error('Username taken')

	await users.create(username)
}
```

The schema can tell the user early; the write boundary still protects integrity against races.

## Cache only when semantics permit it

Caching a remote validation result changes how long that external fact is considered true. Cache only when you can state the expiry, invalidation, and race behavior. Keep that policy in the application/service layer rather than hiding it in a generic validation helper.

## Force an always-promise API only when you need one

A callback-driven schema is maybe-async: an earlier synchronous failure can return directly before the async callback is reached. Append [`toAsync()`](/api/helpers#toasync) when your public API requires a native promise for every invocation.

If the caller is happy with either completion shape, `await schema.execute(input)` already handles both.
