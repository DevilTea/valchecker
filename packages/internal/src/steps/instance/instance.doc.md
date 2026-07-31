<!-- step-doc
category: structures
section: instances
summary: an `instanceof` check against a class
-->

### `instance(constructor, options?)`

Validates with `instanceof`, and infers the constructor's instance type as the output.

```ts
const dateSchema = v.instance(Date)

dateSchema.execute(new Date()) // success
dateSchema.execute('2026-01-01') // failure
```

**Issue code:** `instance:expected_instance` — the value is not an instance of the expected class.
Payload `{ value, expected }`, where `expected` is the configured constructor.
