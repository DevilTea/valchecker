# Primitives

Primitive initial steps check JavaScript and TypeScript primitive identities. Every returned schema participates in Valchecker's state-aware chaining API.

## `string(message?)`

Validates a JavaScript string.

**Issue code:** `string:expected_string`

```ts
v.string().execute('hello') // { value: 'hello' }
v.string().execute(123) // failure
```

Common next steps include `isEmpty()`, `isNotEmpty()`, `isStartingWith()`, `isEndingWith()`, `isLengthAtLeast()`, `isLengthAtMost()`, and string transformations.

## `number(message?)`

Validates the TypeScript `number` primitive by checking `typeof value === 'number'`.

**Issue code:** `number:expected_number`

```ts
v.number().execute(42) // { value: 42 }
v.number().execute(Number.NaN) // { value: NaN }
v.number().execute(Infinity) // { value: Infinity }
v.number().execute('42') // failure
```

`number()` deliberately accepts `NaN`, `Infinity`, and `-Infinity` because all are JavaScript numbers and belong to the TypeScript `number` type.

Use explicit constraints when a narrower runtime domain is required:

```ts
const quantity = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
```

## `boolean(message?)`

Validates a JavaScript boolean.

**Issue code:** `boolean:expected_boolean`

```ts
v.boolean().execute(true) // { value: true }
v.boolean().execute('true') // failure
```

## `bigint(message?)`

Validates a JavaScript bigint.

**Issue code:** `bigint:expected_bigint`

```ts
const id = v.bigint().isAtLeast(0n)

id.execute(42n) // { value: 42n }
id.execute(42) // failure
```

## `symbol(message?)`

Validates a JavaScript symbol.

**Issue code:** `symbol:expected_symbol`

## `literal(value, message?)`

Matches a single literal value exactly.

**Issue code:** `literal:expected_literal`

```ts
const environment = v.literal('production')
```

## `unknown()` and `any()`

Both accept any runtime value without validation:

- `unknown()` outputs `unknown`.
- `any()` outputs `any`.

Use `unknown()` as the safer starting point for `use()`, `check()`, or transformations.

## `never(message?)`

Always fails.

**Issue code:** `never:unexpected_value`

## Nullish primitives

### `null_(message?)`

Accepts only `null`.

**Issue code:** `null:expected_null`

### `undefined_(message?)`

Accepts only `undefined`.

**Issue code:** `undefined:expected_undefined`

# Loose primitives

Loose primitives are initial steps that accept a primitive or its matching TypeScript template-literal string representation, then normalize successful output to the primitive.

They do not implement general JavaScript coercion.

## `looseNumber(message?)`

Input contract: `number | \`${number}\``  
Output: `number`

**Issue code:** `looseNumber:expected_number`

```ts
v.looseNumber().execute(42) // { value: 42 }
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseNumber().execute('0x10') // { value: 16 }
v.looseNumber().execute('NaN') // failure
v.looseNumber().execute('Infinity') // failure
v.looseNumber().execute('') // failure
```

Numeric inputs still include `NaN` and infinity because they belong to `number`. String inputs must represent finite values compatible with TypeScript's `\`${number}\`` type.

## `looseBoolean(message?)`

Input contract: `boolean | \`${boolean}\``  
Output: `boolean`

**Issue code:** `looseBoolean:expected_boolean`

```ts
v.looseBoolean().execute(true) // { value: true }
v.looseBoolean().execute('false') // { value: false }
v.looseBoolean().execute('TRUE') // failure
v.looseBoolean().execute(1) // failure
```

Only the exact strings `"true"` and `"false"` are accepted.

## `looseBigint(message?)`

Input contract: `bigint | \`${bigint}\``  
Output: `bigint`

**Issue code:** `looseBigint:expected_bigint`

```ts
v.looseBigint().execute(42n) // { value: 42n }
v.looseBigint().execute('42') // { value: 42n }
v.looseBigint().execute('-0x10') // { value: -16n }
v.looseBigint().execute('01') // failure
v.looseBigint().execute('1.0') // failure
```

# Built-in validation steps

Built-in validation methods use the `isXxx` prefix and preserve the successful value.

## Numeric constraints

### `isFinite(message?)`

Checks `Number.isFinite(value)`.

**Issue code:** `isFinite:expected_finite`

### `isNaN(message?)`

Checks `Number.isNaN(value)`.

**Issue code:** `isNaN:expected_nan`

### `isInteger(message?)`

Checks `Number.isInteger(value)`.

**Issue code:** `isInteger:expected_integer`

### `isAtLeast(minimum, message?)`

Checks a number or bigint using `value >= minimum`.

**Issue code:** `isAtLeast:expected_at_least`

### `isAtMost(maximum, message?)`

Checks a number or bigint using `value <= maximum`.

**Issue code:** `isAtMost:expected_at_most`

Numeric constraints do not add hidden finite-number requirements:

```ts
v.number().isAtLeast(0).execute(Infinity) // success
v.number().isFinite().isAtLeast(0).execute(Infinity) // failure
```

## Length constraints

### `isLengthAtLeast(minimum, message?)`

Checks `value.length >= minimum`.

**Issue code:** `isLengthAtLeast:expected_length_at_least`

### `isLengthAtMost(maximum, message?)`

Checks `value.length <= maximum`.

**Issue code:** `isLengthAtMost:expected_length_at_most`

```ts
const username = v.string()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)
```

### `isEmpty(message?)`

Checks `value.length === 0`.

**Issue code:** `isEmpty:expected_empty`

### `isNotEmpty(message?)`

Checks `value.length > 0`.

**Issue code:** `isNotEmpty:expected_not_empty`

## String constraints

### `isStartingWith(prefix, message?)`

Checks `value.startsWith(prefix)`.

**Issue code:** `isStartingWith:expected_starting_with`

### `isEndingWith(suffix, message?)`

Checks `value.endsWith(suffix)`.

**Issue code:** `isEndingWith:expected_ending_with`

```ts
const configFile = v.string()
	.isStartingWith('config')
	.isEndingWith('.json')
```

# Generic validation

`check(predicate, message?)` remains the generic high-level validation escape hatch rather than adopting an `isXxx` name:

```ts
const email = v.string().check(value => value.includes('@'))
```

# Custom messages

Every issue-producing step accepts a static message or message handler:

```ts
const schema = v.string()
	.isLengthAtLeast(3, 'Too short')
	.isLengthAtMost(20, 'Too long')
	.isStartingWith('http', ({ payload }) =>
		`Expected ${payload.value} to start with ${payload.prefix}`,
	)
```