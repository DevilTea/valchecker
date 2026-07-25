# Step Implementation Utilities

A method implementation registered through `implStepPlugin()` receives `utils: StepMethodUtils<...>`. These utilities are the supported way for plugin runtime code to register execution work and construct or propagate results.

## Registration

| Utility | Contract |
| --- | --- |
| `addStep(fn, operationMode?)` | Runs on either success or failure and receives the complete current result. |
| `addSuccessStep(fn, operationMode?)` | Runs only while the pipeline is successful and receives the current value. |
| `addFailureStep(fn, operationMode?)` | Runs only while failed and receives a non-empty issue tuple. |

An omitted registration mode inherits the plugin-level default. `implStepPlugin()` defaults conservatively to runtime `maybe-async`; pass `'sync'` only when inherited registrations cannot return a thenable. A registration may explicitly use `'sync'`, `'maybe-async'`, or `'async'`.

## Result utilities

| Utility | Contract |
| --- | --- |
| `success(value)` | Returns `{ value }`. |
| `failure(issueOrIssues)` | Returns `{ issues: [Issue, ...Issue[]] }`; an empty array throws. |
| `isSuccess(result)` | Narrows a result to success. |
| `isFailure(result)` | Narrows a result to failure. |
| `issue(issue)` | Returns an already typed issue unchanged. |

## Issue construction

`createIssue(content)` is constrained by the current method's `Meta.SelfIssue`. It validates the selected code's payload and whether a non-default category is required.

```ts
return failure(createIssue({
	code: 'isPositive:expected_positive',
	payload: { value },
	customMessage: options?.message,
	defaultMessage: 'Expected a positive number.',
}))
```

The default category is `validation`. Supply `category: 'operation'` or `category: 'internal'` when the declared issue requires it.

`createIssue()` creates an internal draft. It records message sources; dynamic handlers run after nested path/context and enclosing message scopes are known. Public execution finalizes the issue once.

## Issue propagation

| Utility | Contract |
| --- | --- |
| `prependIssuePath(issue, path, messageScope?)` | Clones an issue and prepends data-path segments while preserving draft metadata and attaching an optional enclosing message scope. |
| `replaceIssuePath(issue, path, messageScope?)` | Clones an issue but replaces its data path; used by path-remapping structures such as tuple rest regions. |
| `appendIssueContext(issue, context)` | Clones an issue and appends non-data provenance such as union/variant branch context. |

Do not propagate a draft with `{ ...issue }`; the draft metadata is non-enumerable and would be lost.

## Construction metadata

`setMetadata(key, value)` writes a symbol-keyed entry to `~core.metadata` on the schema currently being built. A fresh utility object is created for each fluent call, so metadata is dropped by the next step unless that step writes it again.

The declaring module owns the well-known symbol and any required snapshot/freeze of mutable stored values. Cross-step consumers import the symbol by direct relative path; it is not barrel-exported.

## Recovery example

```ts
addFailureStep((issues) => {
	if (issues.some(issue => issue.category === 'internal'))
		return failure(issues)
	return success(defaultValue)
})
```

Internal issues are fatal and must not be hidden by an ordinary recovery plugin.
