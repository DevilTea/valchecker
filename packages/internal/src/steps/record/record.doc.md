<!-- step-doc
category: structures
section: collections
summary: every own enumerable entry, open or exhaustively closed by the key schema's domain
-->

### `record({ key, value, message?, collectAllIssues? })`

Validates and transforms every own enumerable entry of an object, aligning with TypeScript's
`Record<K, V>`. The key schema, value schema, enclosing message, and issue-collection policy are
supplied through one configuration object.

The key schema's output domain decides the mode:

- **Open domain** (`string`, `number`, `symbol`, template literal): the key schema runs on every own
  enumerable key, and transformed keys must remain unique. Output is an index signature such as
  `{ [k: string]: V }`.
- **Finite domain** (a `literal`, a union of literals, or `isOneOf` — a key schema that advertises a
  finite member set): the record is CLOSED and EXHAUSTIVE. Every member key is required, extra keys
  are rejected, and the key schema is never executed. Output is an all-required mapped object such as
  `{ a: V, b: V }`, matching `Record<'a' | 'b', V>`.

```ts
const ratings = v.record({ key: v.string(), value: v.number() })
ratings.execute({ a: 1, b: 2 })
// { value: { a: 1, b: 2 } }

const flags = v.record({ key: v.union(['read', 'write']), value: v.boolean() })
// output: { read: boolean, write: boolean }
```

Numeric members canonicalize to string keys (`1` becomes `'1'`), matching `Record<1 | '1', V>`, and
two members that collapse to the same property key are one required key. A transformed key from an
open-domain key schema is canonicalized the same way. Own `__proto__` keys are written as safe own
data properties. Inherited and non-enumerable keys are ignored.

A non-object, `null`, or array input fails classification before any entry is read.

In the open domain, each entry runs its key schema before its value schema. In the default mode a key
failure skips that entry's value and stops later entries, and a value failure also stops later
entries. With `collectAllIssues: true` both are collected and later entries are still checked, and a
failed key never reserves its transformed key for a later entry to collide with.

In the finite domain, unknown-key detection happens before member validation and reports every
unknown key in one issue. In the default mode that issue is returned immediately; with
`collectAllIssues: true` the members are validated afterward, and their missing-key and value issues
are appended in member order.

An internal child issue always stops later work, in both modes and under both policies.

The configuration's `message` participates in normal structure message resolution for both owned and
nested child issues, after their paths are prepended.

A key schema that advertises a finite member set containing something that is not a valid property
key throws a `TypeError` while the schema is being constructed, rather than producing an issue at
execution.

**Issues:**

- `record:expected_object` — the value is not a non-null, non-array object. Payload `{ value }`.
- `record:missing_key` (finite domain, a member key is absent) — payload `{ key }`, at path `[key]`.
- `record:unexpected_keys` (finite domain, keys outside the member set) — payload
  `{ keys, expectedKeys }`, at path `[]`.
- `record:duplicate_transformed_key` (open domain, two source keys collapse to one transformed key) —
  payload `{ value, firstSourceKey, sourceKey, transformedKey }`, at path `[transformedKey]` after
  canonicalization.
- key-schema issues (open domain only), with `[sourceKey]` prepended and a
  `{ type: 'record', part: 'key' }` context entry.
- value-schema issues, with `[sourceKey]` prepended.
