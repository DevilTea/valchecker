// `construct/recursive-tree` and `recursion/*`: a self-referential tree schema.
// Nothing in the suite was recursive before this, although all four libraries
// support it as a first-class schema: `generic(factory)` here, `z.lazy()` in both
// Zods, `v.lazy()` in Valibot. Each adapter defines the schema inside its build
// function so construction really rebuilds the whole cycle.
//
// The fixture is a complete binary tree of depth five — 63 nodes over six levels —
// which keeps per-operation cost in the range of the existing `nested-object` and
// 100-element collection scenarios while being deep enough that the recursion,
// rather than one object, is what is measured.
//
// `children` is a required array rather than an optional property, and leaves
// carry an empty one. That keeps the scenario about recursion: optional-field
// semantics differ between the four libraries and are measured by
// `optional-heavy/*` already.
//
// The invalid fixture corrupts the deepest last leaf, so a fail-fast traversal
// still walks the whole tree before failing. All four libraries report exactly one
// issue for it, verified by execution, but the scenario keeps the default
// library-default failure policy and asserts only the failure.
//
// Scope is `equivalent`: the accepted sets, outputs, and failure positions agree.
// The four resolve the cycle differently, which is a cost the numbers should show
// rather than something to normalize away — read from their sources: Valchecker's
// `generic(factory)` and Zod 3's `ZodLazy` invoke the getter on every execution,
// Valibot's `lazy` likewise, and Zod 4 caches the resolved inner schema. Resolving
// per execution is also why the Valchecker pipeline's mode is maybe-async here,
// although every step completes synchronously, which is what keeps the scenario
// comparable at all.
import { construction, warm } from './define.mjs'

function createTree(depth, counter = { next: 0 }) {
	return {
		value: counter.next++,
		children: depth === 0
			? []
			: [createTree(depth - 1, counter), createTree(depth - 1, counter)],
	}
}

function corruptDeepestLeaf(tree) {
	let node = tree
	while (node.children.length > 0)
		node = node.children[node.children.length - 1]
	node.value = 'not-a-number'
	return tree
}

const trees = {
	valid: createTree(5),
	invalidDeep: corruptDeepestLeaf(createTree(5)),
}

const recursiveTreeSteps = ['object', 'number', 'array', 'generic']

export const recursionScenarios = [
	construction('construct/recursive-tree', 'standard', 'recursiveTree', trees.valid, { success: true, output: trees.valid }, { steps: recursiveTreeSteps }),

	warm('recursion/tree-valid', 'standard', 'recursiveTree', trees.valid, { success: true, output: trees.valid }, { steps: recursiveTreeSteps }),
	warm('recursion/tree-invalid-deep', 'full', 'recursiveTree', trees.invalidDeep, { success: false }, { steps: recursiveTreeSteps }),
]
