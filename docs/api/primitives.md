# Primitives

Primitive validators check the basic type of a value. Every primitive returns a schema that supports the full chaining API.

## `string(message?)`

Validates that a value is a JavaScript string.

**Issue Code**: `'string:expected_string'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string('Must be a string')

schema.execute('hello') // { value: 'hello' }
schema.execute(123) // { issues: [{ code: 'string:expected_string', ... }] }
```

**Chainable Methods**:
- `toTrimmed()`, `toTrimmedStart()`, `toTrimmedEnd()` - Trim whitespace
- `toUppercase()`, `toLowercase()` - Case conversion
- `startsWith(prefix)`, `endsWith(suffix)` - Prefix/suffix validation
- `toSplitted(separator)` - Split into array
- `transform(fn)` - Custom transformation
- `check(predicate)` - Custom validation

## `number(message?)`

Validates that a value is a finite JavaScript number (rejects `NaN` and `Infinity`).

**Issue Code**: `'number:expected_number'`

```ts
import { InferOutput } from '@valchecker/internal'

const quantity = v.number()
	.integer()
	.min(1)

quantity.execute(5) // { value: 5 }
quantity.execute(0) // { issues: [{ code: 'min:expected_min', ... }] }
quantity.execute(Number.NaN) // { issues: [{ code: 'number:expected_number', ... }] }
```

**Chainable Methods**:
- `integer()` - Ensure whole number
- `min(value)`, `max(value)` - Value bounds
- `transform(fn)` - Custom transformation
- `check(predicate)` - Custom validation

## `boolean(message?)`

Validates that a value is exactly `true` or `false`.

**Issue Code**: `'boolean:expected_boolean'`

```ts
import { InferOutput } from '@valchecker/internal'

const toggle = v.boolean()

toggle.execute(true) // { value: true }
toggle.execute('true') // { issues: [{ code: 'boolean:expected_boolean', ... }] }
```

## `bigint(message?)`

Validates that a value is a JavaScript BigInt.

**Issue Code**: `'bigint:expected_bigint'`

```ts
import { InferOutput } from '@valchecker/internal'

const id = v.bigint()
	.min(0n)

id.execute(42n) // { value: 42n }
id.execute(-1n) // { issues: [{ code: 'min:expected_min', ... }] }
id.execute(42) // { issues: [{ code: 'bigint:expected_bigint', ... }] }
```

**Chainable Methods**:
- `min(value)`, `max(value)` - Value bounds (use bigint literals like `10n`)

## `symbol(message?)`

Validates that a value is a JavaScript Symbol.

**Issue Code**: `'symbol:expected_symbol'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.symbol()

schema.execute(Symbol('test')) // { value: Symbol(test) }
schema.execute('symbol') // { issues: [...] }
```

## `literal(value, message?)`

Matches a single literal value (string, number, boolean, symbol, null, or undefined).

**Issue Code**: `'literal:expected_literal'`

```ts
import { InferOutput } from '@valchecker/internal'

const envSchema = v.literal('production')

envSchema.execute('production') // { value: 'production' }
envSchema.execute('development') // { issues: [...] }

// Null literal
const nullSchema = v.literal(null)
nullSchema.execute(null) // { value: null }
nullSchema.execute(undefined) // { issues: [...] }
```

**Use Cases**:
- Discriminated union types
- Enum-like constraints
- Exact value matching

## `unknown()`

Accepts any value without validation. Useful as a starting point for deferred validation.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.unknown()

schema.execute('anything') // { value: 'anything' }
schema.execute(123) // { value: 123 }
schema.execute(null) // { value: null }

// Common pattern: defer validation with use()
const deferredSchema = v.unknown()
	.use(actualSchema)
```

### `any()`

Accepts any value, typed as `any` in TypeScript.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.any()

type T = InferOutput<typeof schema> // any
```

### `never(message?)`

Always fails validation. Useful for exhaustive checks or unreachable paths.

**Issue Code**: `'never:unexpected_value'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.never()

schema.execute('anything') // { issues: [{ code: 'never:unexpected_value', ... }] }
```

## Nullish Types

### `null_(message?)`

Accepts only `null`.

**Issue Code**: `'null:expected_null'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.null_()

schema.execute(null) // { value: null }
schema.execute(undefined) // { issues: [...] }
```

### `undefined_(message?)`

Accepts only `undefined`.

**Issue Code**: `'undefined:expected_undefined'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.undefined_()

schema.execute(undefined) // { value: undefined }
schema.execute(null) // { issues: [...] }
```

## Constraint Validators

### `min(value, message?)` / `max(value, message?)`

Validates minimum and maximum bounds. Works with numbers, bigints, and anything with a `length` property (strings, arrays).

**Issue Codes**: `'min:expected_min'`, `'max:expected_max'`

```ts
import { InferOutput } from '@valchecker/internal'

const age = v.number()
	.min(0)
	.max(150)

age.execute(25) // { value: 25 }
age.execute(-5) // { issues: [{ code: 'min:expected_min', ... }] }

const username = v.string()
	.min(3)
	.max(20)

username.execute('alice') // { value: 'alice' }
username.execute('ab') // { issues: [...] }
```

### `integer(message?)`

Validates that a number is an integer (no decimals).

**Issue Code**: `'integer:expected_integer'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.number()
	.integer()

schema.execute(42) // { value: 42 }
schema.execute(42.5) // { issues: [...] }
```

### `empty(message?)`

Validates that value has a length property and is empty (length === 0). Works with strings and arrays.

**Issue Code**: `'empty:expected_empty'`

```ts
import { InferOutput } from '@valchecker/internal'

const emptyString = v.string()
	.empty()

emptyString.execute('') // { value: '' }
emptyString.execute('x') // { issues: [...] }

const emptyArray = v.array(v.string())
	.empty()

emptyArray.execute([]) // { value: [] }
emptyArray.execute(['a']) // { issues: [...] }
```

### `startsWith(prefix, message?)`

Validates that a string starts with the specified prefix.

**Issue Code**: `'startsWith:expected_starts_with'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.startsWith('https://')

schema.execute('https://example.com') // { value: 'https://example.com' }
schema.execute('http://example.com') // { issues: [...] }
```

### `endsWith(suffix, message?)`

Validates that a string ends with the specified suffix.

**Issue Code**: `'endsWith:expected_ends_with'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.endsWith('.json')

schema.execute('config.json') // { value: 'config.json' }
schema.execute('config.yaml') // { issues: [...] }
```

## Custom Messages

Every primitive accepts a message parameter for custom error messages:

### Static Message

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string('Please enter a valid string')
```

### Dynamic Message

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string(({ payload }) =>
	`Expected string, received ${typeof payload.value}`
)
```

### Per-Step Messages

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.min(3, 'Too short')
	.max(20, 'Too long')
	.startsWith('http', 'Must start with http')
```
