# Primitives

Primitive validators check the basic type of a value. Every primitive returns a schema that supports the full chaining API.

## `string(message?)`

Validates that a value is a JavaScript string.

**Issue Code**: `'string:expected_string'`

```ts
const schema = v.string('Must be a string')

schema.run('hello') // { isOk: true, value: 'hello' }
schema.run(123)     // { isOk: false, issues: [{ code: 'string:expected_string', ... }] }
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
const quantity = v.number()
  .integer()
  .min(1)

quantity.run(5)          // { isOk: true, value: 5 }
quantity.run(0)          // { isOk: false, issues: [{ code: 'min:expected_min', ... }] }
quantity.run(Number.NaN) // { isOk: false, issues: [{ code: 'number:expected_number', ... }] }
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
const toggle = v.boolean()

toggle.run(true)    // { isOk: true, value: true }
toggle.run('true')  // { isOk: false, issues: [{ code: 'boolean:expected_boolean', ... }] }
```

## `bigint(message?)`

Validates that a value is a JavaScript BigInt.

**Issue Code**: `'bigint:expected_bigint'`

```ts
const id = v.bigint().min(0n)

id.run(42n)  // { isOk: true, value: 42n }
id.run(-1n)  // { isOk: false, issues: [{ code: 'min:expected_min', ... }] }
id.run(42)   // { isOk: false, issues: [{ code: 'bigint:expected_bigint', ... }] }
```

**Chainable Methods**:
- `min(value)`, `max(value)` - Value bounds (use bigint literals like `10n`)

## `symbol(message?)`

Validates that a value is a JavaScript Symbol.

**Issue Code**: `'symbol:expected_symbol'`

```ts
const schema = v.symbol()

schema.run(Symbol('test'))  // { isOk: true, value: Symbol(test) }
schema.run('symbol')        // { isOk: false, issues: [...] }
```

## `literal(value, message?)`

Matches a single literal value (string, number, boolean, symbol, null, or undefined).

**Issue Code**: `'literal:expected_literal'`

```ts
const envSchema = v.literal('production')

envSchema.run('production')  // { isOk: true, value: 'production' }
envSchema.run('development') // { isOk: false, issues: [...] }

// Null literal
const nullSchema = v.literal(null)
nullSchema.run(null)      // { isOk: true, value: null }
nullSchema.run(undefined) // { isOk: false, issues: [...] }
```

**Use Cases**:
- Discriminated union types
- Enum-like constraints
- Exact value matching

## `unknown()`

Accepts any value without validation. Useful as a starting point for deferred validation.

```ts
const schema = v.unknown()

schema.run('anything')  // { isOk: true, value: 'anything' }
schema.run(123)         // { isOk: true, value: 123 }
schema.run(null)        // { isOk: true, value: null }

// Common pattern: defer validation with use()
const deferredSchema = v.unknown().use(actualSchema)
```

### `any()`

Accepts any value, typed as `any` in TypeScript.

```ts
const schema = v.any()

type T = v.Infer<typeof schema>  // any
```

### `never(message?)`

Always fails validation. Useful for exhaustive checks or unreachable paths.

**Issue Code**: `'never:unexpected_value'`

```ts
const schema = v.never()

schema.run('anything')  // { isOk: false, issues: [{ code: 'never:unexpected_value', ... }] }
```

## Nullish Types

### `null_(message?)`

Accepts only `null`.

**Issue Code**: `'null:expected_null'`

```ts
const schema = v.null_()

schema.run(null)      // { isOk: true, value: null }
schema.run(undefined) // { isOk: false, issues: [...] }
```

### `undefined_(message?)`

Accepts only `undefined`.

**Issue Code**: `'undefined:expected_undefined'`

```ts
const schema = v.undefined_()

schema.run(undefined) // { isOk: true, value: undefined }
schema.run(null)      // { isOk: false, issues: [...] }
```

## Constraint Validators

### `min(value, message?)` / `max(value, message?)`

Validates minimum and maximum bounds. Works with numbers, bigints, and anything with a `length` property (strings, arrays).

**Issue Codes**: `'min:expected_min'`, `'max:expected_max'`

```ts
const age = v.number().min(0).max(150)

age.run(25)   // { isOk: true, value: 25 }
age.run(-5)   // { isOk: false, issues: [{ code: 'min:expected_min', ... }] }

const username = v.string().min(3).max(20)

username.run('alice')  // { isOk: true, value: 'alice' }
username.run('ab')     // { isOk: false, issues: [...] }
```

### `integer(message?)`

Validates that a number is an integer (no decimals).

**Issue Code**: `'integer:expected_integer'`

```ts
const schema = v.number().integer()

schema.run(42)    // { isOk: true, value: 42 }
schema.run(42.5)  // { isOk: false, issues: [...] }
```

### `empty(message?)`

Validates that value has a length property and is empty (length === 0). Works with strings and arrays.

**Issue Code**: `'empty:expected_empty'`

```ts
const emptyString = v.string().empty()

emptyString.run('')   // { isOk: true, value: '' }
emptyString.run('x')  // { isOk: false, issues: [...] }

const emptyArray = v.array(v.string()).empty()

emptyArray.run([])   // { isOk: true, value: [] }
emptyArray.run(['a']) // { isOk: false, issues: [...] }
```

### `startsWith(prefix, message?)`

Validates that a string starts with the specified prefix.

**Issue Code**: `'startsWith:expected_starts_with'`

```ts
const schema = v.string().startsWith('https://')

schema.run('https://example.com')  // { isOk: true, value: 'https://example.com' }
schema.run('http://example.com')   // { isOk: false, issues: [...] }
```

### `endsWith(suffix, message?)`

Validates that a string ends with the specified suffix.

**Issue Code**: `'endsWith:expected_ends_with'`

```ts
const schema = v.string().endsWith('.json')

schema.run('config.json')  // { isOk: true, value: 'config.json' }
schema.run('config.yaml')  // { isOk: false, issues: [...] }
```

## Custom Messages

Every primitive accepts a message parameter for custom error messages:

### Static Message

```ts
const schema = v.string('Please enter a valid string')
```

### Dynamic Message

```ts
const schema = v.string(({ payload }) =>
  `Expected string, received ${typeof payload.value}`
)
```

### Per-Step Messages

```ts
const schema = v.string()
  .min(3, 'Too short')
  .max(20, 'Too long')
  .startsWith('http', 'Must start with http')
```
