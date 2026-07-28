<!-- step-doc
category: structures
section: composition
summary: executes every branch and composes compatible outputs
-->

### `intersection(schemas, options?)`

Executes every branch and composes compatible outputs. By default, branches execute in declaration
order and the first failing branch stops later branch evaluation. With `collectAllIssues: true`,
recoverable branch failures are collected; after the first asynchronous branch is reached, remaining
branches start together.

```ts
const timestamped = v.object({
	createdAt: v.number(),
	updatedAt: v.number(),
})

const auditable = v.object({
	createdBy: v.string(),
	updatedBy: v.string(),
})

const entity = v.intersection([timestamped, auditable])
```

Only plain objects are recursively composed. Enumerable string and symbol keys, compatible cycles,
and shared-reference topology are supported.

Equal primitives and the same non-plain reference are preserved. Distinct `Date`, `Map`, class, or
other non-plain instances conflict.

Output merging runs only when all branches succeed. Merge conflicts are singular structural failures
because no later branch validation remains to collect.

**Issue code:** `intersection:conflicting_outputs` — two branch outputs cannot be merged. Payload
`{ path, leftBranch, rightBranch, leftValue, rightValue, reason }`, where `path` is the graph path
to the conflict, `leftBranch` and `rightBranch` are the branch indexes, and `reason` is one of
`'different_values'`, `'different_references'`, `'incompatible_alias'`, `'incompatible_cycle'`, or
`'incompatible_prototype'`.
