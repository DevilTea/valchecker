<!-- step-doc
category: helpers
section: escape-hatches
summary: generic custom validation escape hatch
-->

### `check<AddedIssue = never>(callback, options?)`

`check()` is the generic validation escape hatch. Under its supported callback contract, `true`,
`undefined`/`void`, or a value returned by `utils.narrow()` passes. Returning `false` or any
string — including the empty string — fails. The callback and its supported results may be direct or
`PromiseLike`; other return types require bypassing the TypeScript contract and are unsupported.

```ts
const positive = v.number()
	.check(value => value > 0, { message: 'Must be positive' })
```

Type-guard overloads narrow the output type:

```ts
const schema = v.unknown()
	.check(
		(value): value is string => typeof value === 'string',
	)
```

Declare `AddedIssue` when `addIssue()` introduces a domain issue. The added issue remains in the
inferred issue union and in the message-handler union:

```ts
import type { ExecutionIssue } from 'valchecker'

type ReservedIssue = ExecutionIssue<
	'domain:reserved_name',
	{ value: string }
>

const username = v.string()
	.check<ReservedIssue>((value, { addIssue }) => {
		if (value === 'admin') {
			addIssue({
				code: 'domain:reserved_name',
				category: 'validation',
				payload: { value },
				message: 'This name is reserved.',
				path: [],
			})
		}
		return true
	})
```

An added issue fails the step even when the callback goes on to pass, as above: the step succeeds
only when nothing was added. If a callback throws or rejects after adding issues, Valchecker
preserves those issues and appends `check:callback_failed`.

**Issues:**

- `check:failed` (`validation`) — the callback returned `false` or a failure message string. Payload
  is either `{ reason: 'returned_false', value }` or
  `{ reason: 'returned_message', value, returnedMessage }`; a returned string is also the issue's
  default message
- `check:callback_failed` (`operation`) — the callback threw or rejected. Payload
  `{ phase: 'throw' | 'reject', value, error }`
