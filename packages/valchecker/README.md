# Valchecker

A powerful TypeScript validation library for schema-based data validation with full type inference and composability.

## Installation

```bash
npm install valchecker
# or
pnpm add valchecker
# or
yarn add valchecker
```

## Usage

Import the library:

```typescript
import * as v from 'valchecker'
```

Valchecker provides a fluent API for defining schemas and validating data. It supports synchronous and asynchronous validation, type narrowing, data transformation, and error recovery.

### Basic Schema Examples

#### String Schema

```typescript
const stringSchema = v.string()

// Valid
const result = v.execute(stringSchema, 'hello')
if (v.isSuccess(result)) {
	console.log(result.value) // 'hello'
}

// Invalid
const invalidResult = v.execute(stringSchema, 123)
console.log(v.isSuccess(invalidResult)) // false
```

#### Number Schema

```typescript
const numberSchema = v.number()

// Valid
const result = v.execute(numberSchema, 42)
if (v.isSuccess(result)) {
	console.log(result.value) // 42
}

// Allow NaN
const numberWithNaNSchema = v.number(true)
const nanResult = v.execute(numberWithNaNSchema, Number.NaN)
console.log(v.isSuccess(nanResult)) // true
```

#### Object Schema

```typescript
const userSchema = v.object({
	name: v.string(),
	age: v.number(),
	isActive: v.boolean(),
})

const validUser = {
	name: 'John Doe',
	age: 30,
	isActive: true,
}

const result = v.execute(userSchema, validUser)
if (v.isSuccess(result)) {
	console.log(result.value) // { name: 'John Doe', age: 30, isActive: true }
}
```

#### Array Schema

```typescript
const stringArraySchema = v.array(v.string())

const result = v.execute(stringArraySchema, ['a', 'b', 'c'])
if (v.isSuccess(result)) {
	console.log(result.value) // ['a', 'b', 'c']
}
```

#### Union Schema

```typescript
const stringOrNumberSchema = v.union(v.string(), v.number())

// Valid for string
const stringResult = v.execute(stringOrNumberSchema, 'hello')
console.log(v.isSuccess(stringResult)) // true

// Valid for number
const numberResult = v.execute(stringOrNumberSchema, 42)
console.log(v.isSuccess(numberResult)) // true

// Invalid for boolean
const booleanResult = v.execute(stringOrNumberSchema, true)
console.log(v.isSuccess(booleanResult)) // false
```

### Advanced Features with Pipes

Valchecker supports chaining operations using pipes for custom validation, transformation, and error handling.

#### Custom Validation with Checks

```typescript
const emailSchema = v.pipe(v.string())
	.check(value => value.includes('@'), 'Must contain @ symbol')
	.check(value => value.includes('.'), 'Must contain dot')
	.check(value => value.length >= 6, 'Must be at least 6 characters')

const result = v.execute(emailSchema, 'user@example.com')
console.log(v.isSuccess(result)) // true
```

#### Data Transformation

```typescript
const ageSchema = v.pipe(v.number())
	.check(value => value >= 0, 'Age must be non-negative')
	.check(value => value <= 150, 'Age must be realistic')
	.transform(value => ({ age: value, isAdult: value >= 18 }))

const result = v.execute(ageSchema, 25)
if (v.isSuccess(result)) {
	console.log(result.value) // { age: 25, isAdult: true }
}
```

#### Error Recovery with Fallback

```typescript
const robustNumberSchema = v.pipe(v.number())
	.check(value => value >= 0, 'Must be non-negative')
	.fallback(() => 0) // Default to 0 if validation fails

const result = v.execute(robustNumberSchema, -5)
if (v.isSuccess(result)) {
	console.log(result.value) // 0
}
```

### Asynchronous Operations

Valchecker supports async checks, transforms, and fallbacks.

```typescript
const asyncUserSchema = v.pipe(v.object({
	name: v.string(),
	email: v.string(),
}))
	.transform(async (user) => {
		// Simulate async operation
		await new Promise(resolve => setTimeout(resolve, 10))
		return {
			...user,
			id: `user_${Date.now()}`,
			email: user.email.toLowerCase(),
		}
	})

const result = await v.execute(asyncUserSchema, {
	name: 'John Doe',
	email: 'JOHN@EXAMPLE.COM',
})
if (v.isSuccess(result)) {
	console.log(result.value.id) // 'user_<timestamp>'
	console.log(result.value.email) // 'john@example.com'
}
```

## More Examples

For comprehensive usage examples, see [`src/examples.test.ts`](./src/examples.test.ts) in the source code, which contains detailed test cases demonstrating various features.

## API Reference

Valchecker provides the following main functions:

- `v.string()`, `v.number()`, `v.boolean()`, etc. - Basic schema constructors
- `v.object(shape)`, `v.array(itemSchema)`, `v.union(...schemas)` - Composite schemas
- `v.pipe(schema).check(...).transform(...).fallback(...)` - Pipe operations
- `v.execute(schema, input)` - Execute validation (sync or async)
- `v.isSuccess(result)`, `v.isValid(schema, input)` - Result checking

For full API documentation, visit the [documentation site](https://github.com/DevilTea/valchecker/tree/main/docs).

## License

MIT
