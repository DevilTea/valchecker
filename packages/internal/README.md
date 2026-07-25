# @valchecker/internal

Semver-covered advanced types, schema construction APIs, and step-plugin author utilities for Valchecker.

Despite the historical package name, the package root is public API. Only exports recorded for `@valchecker/internal` in the repository's `api-surface.json` are supported; package-private source paths and unexported helpers are not.

Install the application package together with the advanced types when both are used directly:

```bash
pnpm add valchecker @valchecker/internal
# or
npm install valchecker @valchecker/internal
```

For a custom all-steps instance without importing the default `v`, install `@valchecker/all-steps` as well.

## Type inference

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'
import { v } from 'valchecker'

const schema = v.object({
	name: v.string().toTrimmed(),
	age: v.looseNumber().isFinite().isInteger(),
})

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

## Custom instances

```ts
import { createValchecker } from '@valchecker/internal'
import { allSteps } from '@valchecker/all-steps'

const v = createValchecker({ steps: allSteps })
```

## Plugin authors

Root exports include the state-aware plugin types and `implStepPlugin()` used to define custom fluent methods. Use the repository's [Custom Steps guide](https://deviltea.github.io/valchecker/guide/custom-steps) for the current `Meta`, `PluginDef`, trailing-options, issue-draft, operation-mode, testing, and tree-shaking contracts.

The package is ESM-only and requires Node.js 22 or newer.
