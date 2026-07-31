<!-- step-doc
category: primitives
section: equality-and-narrowing
summary: `Object.is` equality with one primitive expectation, narrowing the output to it
-->

### `isEqualTo(expected, options?)`

Checks that the value equals the expected primitive. Only a primitive expectation is accepted — a
`bigint`, `boolean`, `null`, `number`, `string`, `symbol`, or `undefined`; an object expectation is
rejected by the type rather than compared structurally. The comparison is `Object.is`, so `NaN`
equals `NaN` while positive and negative zero differ.

Successful output narrows to the expected literal, which is part of the public contract: after
`v.union([v.string(), v.number()]).isEqualTo('ready')` the output is `'ready'`. The method is
unavailable in the initial state, and for an output with no primitive member such as an object-only
output.

```ts
v.number()
	.isEqualTo(Number.NaN)
	.execute(Number.NaN)
// { value: NaN }

v.number()
	.isEqualTo(-0)
	.execute(0)
// failure

v.union([v.string(), v.number()])
	.isEqualTo('ready')
	.execute('ready')
// { value: 'ready' }, output `'ready'`
```

**Issue code:** `isEqualTo:expected_equal_to` — the value is not equal to the expected value.
Payload `{ value, expected }`.
