# Custom Messages

Every issue-producing step accepts a static message or message handler. Messages should remain presentation text; applications should use issue codes and payloads for programmatic behavior.

## Per-step messages

```ts
const payment = v.object({
	currency: v.string().check(
		value => SUPPORTED_CURRENCIES.includes(value),
		'We only accept USD, EUR, and GBP',
	),
	amount: v.number()
		.isFinite()
		.isAtLeast(1, 'Amount must be at least $1.00'),
})
```

A handler receives the fully typed issue:

```ts
const product = v.object({
	sku: v.string(({ payload }) =>
		`Expected a string, received ${typeof payload.value}`,
	),
	price: v.number()
		.isAtLeast(0, ({ payload }) =>
			`Price ${payload.value} is below ${payload.minimum}`,
		),
})
```

Length constraints expose their own explicit payload:

```ts
const username = v.string().isLengthAtLeast(
	3,
	({ payload }) =>
		`Expected at least ${payload.minimum} characters; received ${payload.value.length}`,
)
```

## Global message resolver

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload }) => {
		switch (code) {
			case 'string:expected_string':
				return 'This field must be text'
			case 'number:expected_number':
				return 'This field must be a number'
			case 'isFinite:expected_finite':
				return 'This field must be a finite number'
			case 'isAtLeast:expected_at_least':
				return `Minimum value is ${payload.minimum}`
			case 'isAtMost:expected_at_most':
				return `Maximum value is ${payload.maximum}`
			default:
				return 'Validation failed'
		}
	},
})
```

## Internationalization

Use issue codes as stable translation keys and payload values as interpolation data:

```ts
const translations = {
	en: {
		'string:expected_string': 'This field must be text',
		'isLengthAtLeast:expected_length_at_least': 'Enter at least {minimum} characters',
		'check:failed': 'Validation failed',
	},
	fr: {
		'string:expected_string': 'Ce champ doit être du texte',
		'isLengthAtLeast:expected_length_at_least': 'Saisissez au moins {minimum} caractères',
		'check:failed': 'La validation a échoué',
	},
}

function translate(code: string, payload: Record<string, unknown>, locale: 'en' | 'fr') {
	const template = translations[locale][code] ?? translations.en[code]
	return template?.replace(/\{(\w+)\}/g, (_, key) => String(payload[key] ?? ''))
		?? 'Validation failed'
}
```

```ts
const localized = createValchecker({
	steps: allSteps,
	message: ({ code, payload }) => translate(code, payload, 'fr'),
})
```

## Message priority

Messages resolve in this order:

1. per-step message,
2. global resolver,
3. built-in default,
4. `"Invalid value."`.

```ts
const v = createValchecker({
	steps: allSteps,
	message: () => 'Global message',
})

const schema = v.string()
	.isLengthAtLeast(3, 'Per-step message')
```

The per-step message takes precedence.

## HTTP responses

Expose structured fields rather than only a concatenated message:

```ts
const result = await userSchema.execute(requestBody)

if (v.isFailure(result)) {
	return Response.json({
		error: 'Validation failed',
		details: result.issues.map(issue => ({
			path: issue.path,
			code: issue.code,
			message: issue.message,
			payload: issue.payload,
		})),
	}, { status: 422 })
}
```

Clients may localize `code` independently while logs retain the original structured payload.

## Form errors

```ts
const form = v.object({
	email: v.string()
		.check(value => value.includes('@'), 'Please enter a valid email'),
	password: v.string()
		.isLengthAtLeast(8, 'Password must be at least 8 characters'),
	confirmation: v.string(),
}).check(
	value => value.password === value.confirmation,
	'Passwords must match',
)
```

Use `issue.path` to map nested failures to fields. A root-level cross-field `check()` issue has an empty path unless a custom step supplies a different path.

## Guidance

- Keep user-facing messages actionable and product-specific.
- Keep issue codes stable and machine-readable.
- Do not parse numbers or field names back out of message strings.
- Include sensitive input values in messages or logs only when appropriate.
- Test both default and custom message paths when adding a step.