# String formats

String-format validators check that a `string` output matches a well-known format. Every validator
is a dedicated, tree-shakable step: it is value-preserving (a success returns the input unchanged),
owns a validation issue code of the form `<name>:expected_<format>`, and takes an optional trailing
options object carrying at least `message`. One of them, `isEmoji()`, owns a second issue for a
runtime that cannot express the set it was asked for.

They are available after any step whose output is a `string`, for example `v.string()`:

<!-- typecheck-isolate -->
```ts
import { createValchecker, isEmail, string } from 'valchecker'

const v = createValchecker({ steps: [string, isEmail] })
const schema = v.string()
	.isEmail()
schema.execute('ada@example.com') // { value: 'ada@example.com' }
```

The default `v` instance from `valchecker` bundles every validator, so `v.string().isUrl()` works
without registration.

Each validator documents its strictness and the specification it targets. None of them add hidden
policy beyond the named format.

## Parsed formats

These validators do more than match a pattern.

<!-- steps: parsed -->

## Pattern formats

These validators are backed by a single canonical, vetted regular expression. The dedicated step
still earns its keep through a semantic issue code, a clean default message, and discoverability.

<!-- steps: pattern -->

## Custom messages

Like every issue-producing step, each validator accepts a static message or a typed message handler
in its options object:

```ts
v.string()
	.isEmail({ message: 'Enter a valid email.' })
v.string()
	.isUrl({
		protocols: ['https'],
		message: ({ payload }) => `${payload.value} must use one of ${payload.protocols.join(', ')}`,
	})
```
