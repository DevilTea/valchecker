---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "valchecker"
  text: "Runtime-first validation with zero guesswork"
  tagline: Modular TypeScript validation library with composable steps, full type inference, and deterministic issue reporting. Standard Schema V1 compliant.
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
    title: Composable Step Pipeline
    details: Chain built-in validation steps or create custom plugins. Each step can validate, transform, or handle failures—all with the same ergonomic API.
  - icon: 🎯
    title: Full Type Inference
    details: Schemas stay synchronized with TypeScript types through transforms, narrowing checks, and fallback chains. No manual type assertions needed.
  - icon: 📋
    title: Deterministic Issue Reporting
    details: Every validation failure produces structured issues with codes, payloads, and deep paths—perfect for form validation or API error responses.
  - icon: 🌳
    title: Tree-Shakable by Design
    details: Import all steps with `allSteps` for rapid prototyping, or cherry-pick only what you need for production bundles that stay lean.
  - icon: ⚡
    title: Async-Safe Pipelines
    details: Mix synchronous and asynchronous steps freely. Database checks, API calls, and pure validation all flow through the same deterministic pipeline.
  - icon: 🔧
    title: Batteries-Included Transforms
    details: Trim strings, parse JSON, filter arrays, and normalize data inline—no need to scatter preprocessing logic across your codebase.
---

<script setup>
import { ref } from 'vue'

const codeExample = `import { v } from 'valchecker'

// Define a user schema with composable steps
const UserSchema = v.object({
  name: v.string().toTrimmed().min(1),
  email: v.string(),
  age: [v.number().integer().min(0)],  // Optional
  role: v.union([v.literal('admin'), v.literal('user'), v.literal('guest')]),
})

// Full type inference - no manual types needed
type User = v.Infer<typeof UserSchema>

// Validate with detailed issue reporting
const result = UserSchema.run(input)

if ('value' in result) {
  console.log(result.value) // Fully typed User
} else {
  console.log(result.issues) // Structured issues with paths
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

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 3rem auto;
  max-width: 1200px;
  padding: 0 1.5rem;
}

.feature-card {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
}

.feature-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--vp-c-text-1);
}

.feature-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
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

Define schemas with intuitive, chainable methods. Get full TypeScript inference automatically.

```typescript
import { v } from 'valchecker'

// Define a user schema with composable steps
const UserSchema = v.object({
	name: v.string()
		.toTrimmed()
		.min(1),
	email: v.string(),
	age: [v.number()
		.integer()
		.min(0)], // Optional
	role: v.union([v.literal('admin'), v.literal('user'), v.literal('guest')]),
})

// Full type inference - no manual types needed
type User = v.Infer<typeof UserSchema>

// Validate with detailed issue reporting
const result = UserSchema.run(input)

if ('value' in result) {
	console.log(result.value) // Fully typed User
}
else {
	console.log(result.issues) // Structured issues with paths
}
```

</div>

<div class="why-section">

## Why Valchecker?

Unlike validation libraries that treat runtime and compile-time as separate concerns, **Valchecker unifies them**. Every schema is both a runtime validator and a TypeScript type generator. Transforms update types automatically. Failures produce predictable, structured issues—not thrown exceptions. The result is validation code that's easier to write, test, and maintain.

</div>

<div class="cta-section">

<div class="install-cmd">npm install valchecker</div>

[Get Started →](/guide/quick-start) · [View API Reference →](/api/overview) · [See Examples →](/examples/basic-validation)

</div>
