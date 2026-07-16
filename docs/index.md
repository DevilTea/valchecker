---
layout: home

hero:
  name: "valchecker"
  text: "Runtime-first validation with zero guesswork"
  tagline: Type-aligned initial schemas, state-aware fluent validation, tree-shakable plugins, and deterministic structured issues.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: API Reference
      link: /api/overview
    - theme: alt
      text: GitHub
      link: https://github.com/DevilTea/valchecker

features:
  - icon: 🔗
    title: State-Aware Fluent API
    details: Initial schemas use nouns, validations use `isXxx`, and concrete transforms use `toXxx`, so editor autocomplete exposes only meaningful next steps.
  - icon: 🎯
    title: TypeScript-Aligned Primitives
    details: Primitive schemas mirror TypeScript identities. Runtime constraints such as finite numbers remain explicit, composable validation steps.
  - icon: 📋
    title: Deterministic Issue Reporting
    details: Validation failures produce structured issues with codes, payloads, and deep paths rather than throwing validation exceptions.
  - icon: 🌳
    title: Tree-Shakable by Design
    details: Use the default all-steps instance or build a custom instance from selected plugins while keeping the same fluent API.
  - icon: ⚡
    title: Sync and Maybe-Async Pipelines
    details: Direct values, promises, and thenables preserve execution order and the pipeline's actual completion mode.
  - icon: 🔧
    title: Explicit Normalization
    details: Loose primitives normalize TypeScript-compatible string representations without falling back to unrestricted JavaScript coercion.
---

<script setup>
const codeExample = `import { v } from 'valchecker'

const UserSchema = v.object({
  name: v.string().toTrimmed().isNotEmpty(),
  email: v.string().toLowercase(),
  age: [v.looseNumber().isFinite().isInteger().isAtLeast(0)],
  role: v.union([
    v.literal('admin'),
    v.literal('user'),
    v.literal('guest'),
  ]),
})

const result = await UserSchema.execute(input)

if (v.isSuccess(result)) {
  console.log(result.value)
} else {
  console.log(result.issues)
}`
</script>

<style>
.vp-doc {
  max-width: 100%;
}

.code-showcase {
  margin: 2rem auto;
  max-width: 800px;
  padding: 0 1.5rem;
}

.code-showcase h2 {
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
}

.code-showcase p {
  text-align: center;
  color: var(--vp-c-text-2);
  margin-bottom: 1.5rem;
}

.why-section {
  margin: 4rem auto;
  max-width: 800px;
  padding: 0 1.5rem;
  text-align: center;
}

.why-section h2 {
  font-size: 1.75rem;
  margin-bottom: 1rem;
}

.why-section p {
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.cta-section {
  text-align: center;
  margin: 4rem auto;
  padding: 2rem;
}

.cta-section .install-cmd {
  display: inline-block;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1rem 2rem;
  font-family: var(--vp-font-family-mono);
  font-size: 1rem;
  color: var(--vp-c-text-1);
  margin-bottom: 1rem;
}
</style>

<div class="code-showcase">

## See It In Action

The method name identifies the step's role, while the available methods narrow as the pipeline output changes.

```ts
import type { InferOutput } from '@valchecker/internal'
import { v } from 'valchecker'

const UserSchema = v.object({
	name: v.string()
		.toTrimmed()
		.isNotEmpty(),
	email: v.string()
		.toLowercase(),
	age: [v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(0)],
	role: v.union([
		v.literal('admin'),
		v.literal('user'),
		v.literal('guest'),
	]),
})

type User = InferOutput<typeof UserSchema>

const result = await UserSchema.execute(input)

if (v.isSuccess(result)) {
	console.log(result.value)
}
else {
	console.log(result.issues)
}
```

</div>

<div class="why-section">

## Why Valchecker?

Valchecker treats runtime validation, output transformation, TypeScript inference, and bundle composition as one API design problem. Primitive initial steps mirror TypeScript types; additional runtime guarantees are explicit `isXxx` validations; concrete output changes are `toXxx` transformations. Generic `check()` and `transform()` remain available when a named step cannot express the requirement.

</div>

<div class="cta-section">

<div class="install-cmd">npm install valchecker</div>

[Get Started →](/guide/quick-start) · [View API Reference →](/api/overview) · [See Examples →](/examples/basic-validation)

</div>