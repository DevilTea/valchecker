# Primitives

Primitive validators check the basic type of a value before any transformations occur. Every primitive returns a schema that supports the full chaining API.

## `string(message?)`

Validates that a value is a JavaScript string.

**Issue Code**: `'string:expected_string'`

```ts
const schema = v.string('Must be a string')

schema.execute('hello') // { value: 'hello' }
schema.execute(123) // { issues: [{ code: 'string:expected_string', ... }] }
```

**Chainable Methods**:
- `toTrimmed()`, `toTrimmedStart()`, `toTrimmedEnd()`
- `toUppercase()`, `toLowercase()`
- `startsWith(prefix)`, `endsWith(suffix)`
- `min(length)`, `max(length)`

## `number(message?)`

Validates that a value is a finite number (rejects `NaN` and infinities).

**Issue Code**: `'number:expected_number'`

```ts
const quantity = v.number()
	.integer()
	.min(1)

quantity.execute(5) // { value: 5 }
quantity.execute(0) // { issues: [{ code: 'min:expected_min', ... }] }
quantity.execute(Number.NaN) // { issues: [{ code: 'number:expected_number', ... }] }
```

**Chainable Methods**:
- `integer()` - Ensures whole number
- `min(value)`, `max(value)`

## `boolean(message?)`

Validates that a value is exactly `true` or `false`.

**Issue Code**: `'boolean:expected_boolean'`

```ts
const toggle = v.boolean()

toggle.execute(true) // { value: true }
toggle.execute('true') // { issues: [{ code: 'boolean:expected_boolean', ... }] }
```

## `literal(value, message?)`

Matches a single literal value (string, number, boolean, symbol, null, or undefined).

**Issue Code**: `'literal:expected_literal'`

```ts
const envSchema = v.literal('production')

envSchema.execute('production') // { value: 'production' }
envSchema.execute('development') // { issues: [{ code: 'literal:expected_literal', ... }] }
```

Useful for:
- Discriminated union types
- Enum-like constraints
- Exact value matching

## Nullish Types

### `null_(message?)`

Accepts only `null`.

**Issue Code**: `'null:expected_null'`

### `undefined_(message?)`

Accepts only `undefined`.

**Issue Code**: `'undefined:expected_undefined'`

### `unknown(message?)`

Accepts any value without validation. Useful as a starting point for deferred validation with `use()`.

### `never(message?)`

Always fails validation.

**Issue Code**: `'never:unexpected_value'`

## Additional Primitives

### `bigint(message?)`

Validates `bigint` values for high-precision integers.

**Issue Code**: `'bigint:expected_bigint'`

```ts
const id = v.bigint()
	.min(0n)

id.execute(42n) // { value: 42n }
id.execute(-1n) // { issues: [{ code: 'min:expected_min', ... }] }
```

### `symbol(message?)`

Validates `symbol` values.

**Issue Code**: `'symbol:expected_symbol'`

## Optional Properties

When defining object schemas, wrap any step in an array `[]` to mark the property as optional:

```ts
const product = v.object({
	name: v.string(),
	description: [v.string()
		.max(500)], // Optional property
})

product.execute({ name: 'Widget' })
// { value: { name: 'Widget', description: undefined } }
```

## Custom Messages

Every primitive accepts either a static string or a function for custom error messages:

```ts
const sku = v.string(({ payload }) =>
	`Expected SKU string, received ${typeof payload.value}`,
)
```
