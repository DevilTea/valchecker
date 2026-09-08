---
description: Customize human-facing validation messages while keeping issue codes, paths, context, and payloads as the machine-readable contract.
relatedSources:
  - packages/internal/src/core/core.ts
  - packages/internal/src/core/types.ts
---
# Custom Messages and Error Responses

Messages are presentation text. Application logic should branch on structured issue fields such as `code`, `category`, `path`, `context`, and `payload` rather than parsing a sentence back into data.

## Choose local or global message ownership

Use a per-step message when the wording belongs to one product rule. Use an instance-level resolver when your application has a shared presentation or localization policy.

<<< ../.examples/guides-recipes/custom-messages/example.ts

The checked fixture proves two important cases: an originating per-step message wins for that issue, while an issue without a local message falls through to the instance-level resolver.

| Requirement | Best owner |
| --- | --- |
| Product-specific wording for one rule | Per-step `message` option |
| Shared wording for many issue codes | `createValchecker({ message })` resolver |
| Locale selection and interpolation | Application localization layer keyed by issue `code` + `payload` |
| Field placement in forms | `issue.path`, not the message text |
| API/client branching | `code`, `category`, and structured payload/context |

The full message-resolution precedence and exception guarantees are part of the [Valchecker 1.0 Contract](/reference/v1-contract); this guide does not duplicate that formal list.

## Localize from structured data

Treat issue codes as translation identities and payload values as interpolation data:

```ts
interface LocalizedIssue {
	code: string
	payload: Record<string, unknown>
}

function translateIssue(issue: LocalizedIssue, locale: 'en' | 'zh-TW'): string {
	if (issue.code === 'isAtLeast:expected_at_least') {
		const minimum = String(issue.payload.minimum)
		return locale === 'zh-TW'
			? `數值至少必須是 ${minimum}`
			: `Value must be at least ${minimum}`
	}

	return locale === 'zh-TW' ? '資料驗證失敗' : 'Validation failed'
}
```

This keeps localization policy independent from the schema's machine-readable contract. Do not rely on parsing a default English message to recover the code or numeric parameters.

## Return structured API errors

Translate a Valchecker failure into your transport shape at the application boundary:

```ts
import type { AnyExecutionIssue } from 'valchecker'

function toErrorDetails(issues: readonly AnyExecutionIssue[]) {
	return issues.map(issue => ({
		path: issue.path,
		context: issue.context,
		code: issue.code,
		category: issue.category,
		message: issue.message,
		payload: issue.payload,
	}))
}
```

A client can display `message`, map `path` to a field, localize `code` independently, or log `payload` according to its own policy. Avoid flattening all of that information into one concatenated string too early.

## Map form errors by path

For nested schemas, `path` is the stable data-location signal. A root-level cross-field `check()` normally produces a root issue unless a custom step deliberately supplies another path.

Use [Issues and Paths](/core-concepts/issues-and-paths) for the path/context mental model; use the generated [API Reference](/api/overview) for exact issue codes and payloads owned by individual built-in steps.

## Handle message resolver failures as real failures

Message handlers run inside Valchecker's public execution boundary. If message resolution itself fails, Valchecker reports its internal message-resolution issue rather than treating the thrown text formatter as an ordinary user validation failure.

That is another reason not to put domain state mutations or transport side effects inside a message callback: the callback's job is to render an already-structured issue.

## Keep sensitive values deliberate

Payloads can contain input-derived values. Before echoing them into messages, logs, telemetry, or HTTP responses, decide whether that data is safe for the destination. Custom wording should improve usability without turning validation diagnostics into an accidental data leak.
