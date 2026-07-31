<!-- step-doc
category: helpers
section: type-level
summary: lazy or recursive schema construction
-->

### `generic<T>(factory)`

Builds lazy or recursive schemas. `T` declares what the composed step contributes — its `output`,
and optionally its `operationMode` and `issue` — and the argument is either another schema or a
factory returning one. A factory is resolved on every execution, which is what makes a
self-reference possible.

```ts
interface TreeNode {
	value: number
	children?: TreeNode[]
}

const treeSchema = v.object({
	value: v.number(),
	// The factory's `any` return type breaks the inference cycle a bare
	// self-reference would create. The output type still comes from the
	// `generic<{ output: TreeNode }>` argument; the annotation only gives up the
	// check that the factory returns a schema.
	children: [v.array(
		v.generic<{ output: TreeNode }>((): any => treeSchema),
	)],
})
```

`InferOutput<typeof treeSchema>` is `{ value: number, children: TreeNode[] | undefined }`: the
`[schema]` optional-field shorthand always materializes the property, so the output key is present
with `undefined` rather than optional. Use `TreeNode` for the recursive annotation, as above, and
read the schema's own output type when you need the exact shape.

This step owns no issue: the issues are the composed schema's own.
