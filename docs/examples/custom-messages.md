# Custom Messages

Adapt validation error messages to your product voice, support internationalization, or provide context-specific feedback.

## Per-Step Messages

Pass custom messages directly to individual validation steps.

### Static Messages

```ts
const paymentSchema = v.object({
	currency: v.string()
		.check(
			value => SUPPORTED_CURRENCIES.includes(value),
			'We only accept USD, EUR, and GBP',
		),
	amount: v.number()
		.min(1, 'Amount must be at least $1.00'),
})
```

### Dynamic Messages

Use a function to access issue payload:

```ts
const productSchema = v.object({
	sku: v.string((info) => {
		return `Invalid SKU: expected string, received ${typeof info.payload.value}`
	}),
	price: v.number()
		.min(0, ({ payload }) => {
			return `Price ${payload.value} is below minimum of ${payload.expected}`
		}),
})
```

## Global Message Handler

Define a centralized translator for all validation errors.

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload }) => {
		// Map error codes to user-friendly messages
		switch (code) {
			case 'string:expected_string':
				return 'This field must be text'
			case 'number:expected_number':
				return 'This field must be a number'
			case 'min:expected_min':
				return `Minimum value is ${payload.expected}`
			case 'max:expected_max':
				return `Maximum value is ${payload.expected}`
			default:
				return 'Validation failed'
		}
	},
})
```

## Internationalization

Implement multi-language support with a translation function.

### Translation Helper

```ts
const translations = {
	en: {
		'string:expected_string': 'This field must be text',
		'min:expected_min': 'Minimum value is {expected}',
		'check:failed': 'Validation failed',
	},
	fr: {
		'string:expected_string': 'Ce champ doit être du texte',
		'min:expected_min': 'La valeur minimale est {expected}',
		'check:failed': 'La validation a échoué',
	},
}

function translate(code: string, payload: any, locale: string) {
	const template = translations[locale]?.[code] ?? translations.en[code]
	if (!template)
		return 'Validation failed'

	// Replace {key} placeholders with payload values
	return template.replace(/\{(\w+)\}/g, (_, key) => payload[key] ?? '')
}
```

### Global Handler with Locale

```ts
function createLocalizedValchecker(locale: string) {
	return createValchecker({
		steps: allSteps,
		message: ({ code, payload }) => translate(code, payload, locale),
	})
}

const vFr = createLocalizedValchecker('fr')
const schema = vFr.string()
	.min(3)

const result = schema.execute('ab')
// result.issues[0].message === 'La valeur minimale est 3'
```

## API Error Responses

Format validation issues for HTTP API responses.

### Simple Format

```ts
const result = await userSchema.execute(req.body)

if (v.isFailure(result)) {
	return res.status(422)
		.json({
			error: 'Validation failed',
			details: result.issues.map(issue => ({
				field: issue.path.join('.'),
				message: issue.message,
			})),
		})
}
```

### Detailed Format with Codes

```ts
if (v.isFailure(result)) {
	return res.status(422)
		.json({
			error: 'Validation failed',
			details: result.issues.map(issue => ({
				field: issue.path.join('.'),
				code: issue.code,
				message: issue.message,
				payload: issue.payload,
			})),
		})
}
```

Clients can use the `code` field for their own localization:

```ts
// Client-side
const errorMessage = translateError(
	issue.code,
	issue.payload,
	userSettings.locale,
)
```

## Form Validation

Map issue paths to form field names for UI highlighting.

```ts
const formSchema = v.object({
	email: v.string()
		.check(v => v.includes('@'), 'Please enter a valid email'),
	password: v.string()
		.min(8, 'Password must be at least 8 characters'),
	confirmPassword: v.string(),
})
	.check(
		data => data.password === data.confirmPassword,
		'Passwords must match',
	)

const result = await formSchema.execute(formData)

if (v.isFailure(result)) {
	// Create field -> error message map
	const fieldErrors = new Map<string, string>()

	for (const issue of result.issues) {
		const fieldName = issue.path.join('.')
		// Take first error for each field
		if (!fieldErrors.has(fieldName)) {
			fieldErrors.set(fieldName, issue.message)
		}
	}

	// Highlight fields in UI
	for (const [field, message] of fieldErrors) {
		highlightField(field, message)
	}
}
```

## Message Priority

Messages are resolved in this order (highest to lowest priority):

1. **Per-step message** (inline with step call)
2. **Global message handler**
3. **Built-in default message**

```ts
const v = createValchecker({
	steps: allSteps,
	message: () => 'Global handler message',
})

const schema = v.string()
	.min(3, 'Per-step message') // This takes precedence

const result = schema.execute('ab')
// result.issues[0].message === 'Per-step message'
```

## Best Practices

### Keep Messages User-Friendly

```ts
// Technical jargon
'Value failed regex /^[A-Z]{3}$/ validation'

// Clear explanation
'Currency code must be 3 uppercase letters (e.g., USD, EUR)'
```

### Include Contextual Information

```ts
// Vague
'Invalid value'

// Specific
const message = `Price ${payload.value} is below minimum of ${payload.expected}`
```

### Use Consistent Tone

Match your product's voice throughout all error messages.

### Provide Actionable Guidance

```ts
// Just states the problem
'Username already taken'

// Suggests solution
'Username already taken. Try adding numbers or underscores.'
```
