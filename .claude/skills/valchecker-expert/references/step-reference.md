# Built-in Step Inventory

This inventory lists the public fluent plugins shipped by the current Valchecker package. Exact parameter, issue, and structural semantics are documented in the VitePress API pages and the canonical JSDoc on each plugin definition.

## Initial schemas

### Primitive and general

`any`, `unknown`, `never`, `string`, `number`, `boolean`, `bigint`, `symbol`, `literal`, `null`, `undefined`, `date`, `file`, `blob`, `instance`, `templateLiteral`

`number()` accepts every JavaScript number. `date()` additionally rejects Invalid Date.

### Loose primitives

`looseNumber`, `looseBoolean`, `looseBigint`

They accept the primitive or the documented TypeScript-template-compatible string grammar and normalize to the primitive.

### Structures and combinators

`object`, `strictObject`, `looseObject`, `array`, `tuple`, `set`, `map`, `record`, `union`, `variant`, `intersection`

Optional object fields use `[schema]`. Tuple rest uses a single `'...'` followed by an array schema. Map and record take one configuration object containing key and value schemas.

## Built-in validations

### Primitive equality and nullish narrowing

`isEqualTo`, `isOneOf`, `isDefined`, `isNonNull`, `isNonNullish`

### Numbers and bigints

`isFinite`, `isNaN`, `isInteger`, `isSafeInteger`, `isAtLeast`, `isAtMost`, `isGreaterThan`, `isLessThan`, `isMultipleOf`

### Dates

`isAfter`, `isBefore`

### Length, size, and membership

`isEmpty`, `isNotEmpty`, `isLengthAtLeast`, `isLengthAtMost`, `isLengthExactly`, `isSizeAtLeast`, `isSizeAtMost`, `isSizeExactly`, `isIncluding`, `isIncludingKey`, `isIncludingValue`

### Strings and formats

`json`, `isStartingWith`, `isEndingWith`, `isMatching`, `isEmail`, `isUrl`, `isUuid`, `isIp`, `isIsoDate`, `isIsoTime`, `isIsoDateTime`, `isJwt`, `isEmoji`, `isHex`, `isMac`, `isHostname`, `isBase64`, `isBase64Url`, `isCuid2`, `isUlid`, `isNanoid`

`json()` validates that a string is parseable JSON while preserving the string; `toJSONValue()` performs the parsing transformation.

`isEmoji()` accepts every structurally valid UTS #51 emoji sequence. `isEmoji({ registered: true })` narrows that to Unicode's RGI set, costs roughly 110× more, and needs a runtime with the regular-expression `v` flag — without it that call fails with `isEmoji:unsupported_registered_set` instead of accepting a different set.

### File-like values

`isMimeType`

## Concrete transformations

### Strings and JSON

`toTrimmed`, `toTrimmedStart`, `toTrimmedEnd`, `toLowercase`, `toUppercase`, `toNormalized`, `toSplit`, `toJSONValue`, `toJSONString`, `toString`

### Primitive/date conversions

`toNumber`, `toBoolean`, `toBigint`, `toSafeNumber`, `toMappedBoolean`, `toDate`

Native conversions retain native coercion semantics; policy conversions are explicit. Identity primitive conversions are hidden by the state-aware API.

### Arrays and collections

`toFiltered`, `toMapped`, `toSorted`, `toSliced`, `toLength`, `toSize`, `toArray`, `toKeys`, `toValues`, `toEntries`, `toMappedKeys`, `toMappedValues`

`toArray()` is the Set representation transform. Map representations use `toKeys`, `toValues`, or `toEntries`.

## Generic and flow-control operations

`check`, `transform`, `fallback`, `use`, `generic`, `as`, `toAsync`

- `check()` validates, can narrow via a type guard, and supports typed added issues.
- `transform()` changes arbitrary output and normalizes callback throw/rejection into an operation issue.
- `fallback()` recovers validation/operation failures; internal failures are fatal.
- `use()` delegates to another schema.
- `generic()` supplies lazy or recursive schema references.
- `as<T>()` changes compile-time output only.
- `toAsync()` forces every execution to return a native promise.

## Results

```ts
type ExecutionResult<Value, Issue>
	= | { value: Value }
		| { issues: [Issue, ...Issue[]] }
```

Every public issue includes `code`, `category`, `payload`, `message`, `path`, and optional `context`.

## Selective registration

Every name above is a public plugin export. Register only the plugins needed by a custom instance, or use the default `v`/`allSteps` for the complete set. `allSteps` is discovered from runtime-marked exports rather than a maintained static list.
