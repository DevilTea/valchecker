<!-- step-doc
category: structures
section: composition
summary: direct discriminator lookup that executes only the selected branch
-->

### `variant(options)`

Reads one own discriminator property, performs direct property-key lookup, and executes only the
selected branch.

```ts
const event = v.variant({
	discriminator: 'type',
	variants: {
		click: v.object({
			type: v.literal('click'),
			x: v.number(),
			y: v.number(),
		}),
		keypress: v.object({
			type: v.literal('keypress'),
			key: v.string(),
		}),
	},
})
```

Inputs must be non-null, non-array objects. The discriminator must be an own property whose value is
a configured string, number, or symbol property key. Number and string values follow JavaScript
property-key canonicalization, so `1` and `'1'` select the same object-key branch.

Variant maps are non-empty schema-time snapshots, and a malformed configuration throws a `TypeError`
while the schema is being constructed rather than failing at execution: a missing configuration
object, a discriminator that is not a property key, a `variants` value that is not an object, an
empty variant map, or a branch that is not a Valchecker schema.

Child issue paths remain unchanged and receive
`{ type: 'variant', discriminator, discriminatorValue }` context. A variant-level `message` is an
enclosing structure scope; an originating child-step message retains priority.

If every branch is synchronous, the schema is synchronous. Otherwise selection remains maybe-async
because invalid discriminators can still fail synchronously. Unselected branches never execute.

**Issue codes:**

- `variant:expected_object` — the value is not a non-null, non-array object. Payload `{ value }`.
- `variant:invalid_discriminator` — the own discriminator property is absent, or its value is not
  a configured variant key. Payload `{ value, discriminator, received, expected }`, with the
  discriminator as the issue path.

Issues from the selected branch are returned as they are.
