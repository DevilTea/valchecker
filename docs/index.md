---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "valchecker"
  text: "Type-Safe Schema Validation"
  tagline: A powerful, fluent API for data validation and transformation in TypeScript
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/DevilTea/valchecker

features:
  - title: Type Safety First
    details: Full TypeScript inference with automatic type narrowing and transformation
  - title: Fluent API
    details: Chain validation, transformation, and error recovery operations seamlessly
  - title: StandardSchemaV1 Compliant
    details: Compatible with the emerging standard for schema validation libraries
  - title: Async Support
    details: Built-in support for asynchronous validation and data processing
  - title: Composable
    details: Build complex schemas from simple, reusable primitives
  - title: Lightweight
    details: Minimal dependencies with excellent performance
---

## Quick Example

```typescript
import * as v from 'valchecker'

// Define a schema
const userSchema = v.object({
	name: v.string(),
	age: v.number(),
	email: v.pipe(v.string())
		.check(email => email.includes('@'), 'Invalid email')
		.transform(email => email.toLowerCase())
})

// Validate data
const result = v.execute(userSchema, {
	name: 'John Doe',
	age: 30,
	email: 'JOHN@EXAMPLE.COM'
})

if (v.isSuccess(result)) {
	console.log(result.value)
	// { name: 'John Doe', age: 30, email: 'john@example.com' }
}
```

## Installation

```bash
npm install valchecker
# or
pnpm add valchecker
# or
yarn add valchecker
```
