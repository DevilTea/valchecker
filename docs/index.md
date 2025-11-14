---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "valchecker"
  text: "Runtime-first validation with zero guesswork"
  tagline: Modular TypeScript validation library with composable steps, full type inference, and deterministic issue reporting.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: View on GitHub
      link: https://github.com/DevilTea/valchecker

features:
  - title: Composable Step Pipeline
    details: Chain built-in validation steps or create custom plugins. Each step can validate, transform, or handle failures—all with the same ergonomic API.
  - title: Full Type Inference
    details: Schemas stay synchronized with TypeScript types through transforms, narrowing checks, and fallback chains. No manual type assertions needed.
  - title: Deterministic Issue Reporting
    details: Every validation failure produces structured issues with codes, payloads, and deep paths—perfect for form validation or API error responses.
  - title: Tree-Shakable by Design
    details: Import all steps with `allSteps` for rapid prototyping, or cherry-pick only what you need for production bundles that stay lean.
  - title: Async-Safe Pipelines
    details: Mix synchronous and asynchronous steps freely. Database checks, API calls, and pure validation all flow through the same deterministic pipeline.
  - title: Batteries-Included Transforms
    details: Trim strings, parse JSON, filter arrays, and normalize data inline—no need to scatter preprocessing logic across your codebase.
---
