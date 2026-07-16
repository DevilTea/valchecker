# Migrating to Valchecker 1.0

`1.0.0-rc.0` establishes the intended 1.0 compatibility contract. Applications upgrading from pre-1.0 releases should review every item below.

## Required migration review

- Runtime support is Node.js 22 or newer.
- Published packages are ESM-only; CommonJS uses dynamic `import()`.
- Built-in validations now use `isXxx` names, concrete transformations use `toXxx`, and generic `check()` and `transform()` retain their names.
- Numeric `min()` and `max()` become `isAtLeast()` and `isAtMost()`; length bounds become `isLengthAtLeast()` and `isLengthAtMost()`.
- `empty()`, `integer()`, `startsWith()`, and `endsWith()` become `isEmpty()`, `isInteger()`, `isStartingWith()`, and `isEndingWith()`.
- `parseJSON()`, `stringifyJSON()`, and `toSplitted()` become `toJSONValue()`, `toJSONString()`, and `toSplit()`.
- `number()` now matches TypeScript `number`, including `NaN` and positive or negative infinity. Add `isFinite()` where required.
- `looseNumber()` now normalizes TypeScript-compatible number strings; `looseBoolean()` and `looseBigint()` apply the same model.
- Message maps and snapshots must use renamed issue codes and explicit `minimum` or `maximum` payload fields.
- `execute()` preserves sync or maybe-async behavior; use `.toAsync()` for an unconditional promise.
- Callback steps support `PromiseLike` values.
- `union()` returns the first successful branch's transformed output.
- `intersection()` uses graph-aware plain-object composition and rejects incompatible distinct non-plain instances.
- Object validators read declared own properties only.
- `strictObject()` includes unknown enumerable symbol keys.
- `looseObject()` preserves unknown own properties and is not an alias for `object()`.
- Issue-path prepending does not mutate child issues.
- Plugin methods cannot collide with core names or use `then` or symbol names.
- Accidental implementation helpers have been removed from public exports.

## Common rename example

Before:

```ts
v.string()
	.min(3)
	.max(20)
	.startsWith('user_')
```

After:

```ts
v.string()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)
	.isStartingWith('user_')
```

Finite numeric validation should now be explicit:

```ts
v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(0)
```

The complete migration procedure, issue-code mapping, examples, removed-export list, and verification checklist are maintained in the repository's [MIGRATION.md](https://github.com/DevilTea/valchecker/blob/main/MIGRATION.md).

For normative behavior after migration, read the [Valchecker 1.0 Contract](/guide/v1-contract).

## Release-candidate feedback

Report RC problems with:

- exact Valchecker version,
- Node.js and TypeScript versions,
- module resolution mode,
- minimal schema and input,
- actual and expected result,
- whether execution used `execute()` or `~standard`.

Release-candidate fixes are published under new `1.0.0-rc.N` versions. Existing npm versions are never overwritten.