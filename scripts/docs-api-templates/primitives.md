# Primitives

Primitive initial steps check JavaScript and TypeScript identities, and the validations on this page preserve the successful value while enforcing only the condition their name expresses. Message-bearing methods use a trailing options object, for example `string({ message })`, `literal(value, { message })`, and `isAtLeast(minimum, { message })`.

## Initial schemas

An initial schema opens a pipeline: it is available on the instance rather than after another step.

<!-- steps: initial -->

## Loose primitives

Loose primitives accept the primitive or its corresponding TypeScript template-literal string representation, then produce the canonical primitive. They do not perform unrestricted JavaScript coercion, and each one accepts exactly the strings its TypeScript template type describes.

Each is an initial schema rather than a coercion helper: it is available on the instance, or after an output that is exactly `unknown` or `any`. Converting an output an earlier step already produced is what `toNumber()`, `toBigint()`, and `toMappedBoolean()` are for.

<!-- steps: loose -->

## Template literals

<!-- steps: template-literal -->

## Numeric validation

<!-- steps: numeric -->

## Date validation

<!-- steps: date -->

## Length, emptiness, and inclusion

These validations read a value's own `length` — or its `size`, where the value is a collection — or use the corresponding native string, array, or Set operation. `isEmpty()`, `isNotEmpty()`, and `isIncluding()` are here rather than on [Structures](/api/structures) because they read a string or an array as readily as a Map or a Set; the dedicated `size` bounds are [there](/api/structures#isSizeAtLeast).

<!-- steps: length-and-inclusion -->

## Equality and nullish narrowing

<!-- steps: equality-and-narrowing -->

## JSON strings

<!-- steps: json -->

## Related pages

- The dedicated string-format validators — `isEmail()`, `isUrl()`, `isUuid()` and the rest — are on [String formats](/api/formats).
- `check()`, the generic validation escape hatch for a condition no built-in expresses, is on [Helpers & Utilities](/api/helpers#check).
