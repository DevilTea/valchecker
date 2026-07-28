<!-- step-doc
category: helpers
section: execution-mode
summary: force the complete schema to return a native promise
-->

### `toAsync()`

Forces every invocation of the complete schema to return a native promise, including otherwise
synchronous successes and early failures.

```ts
const schema = v.string()
	.check(async value => value.length > 0)
	.toAsync()
```

It changes execution mode, not the successful value.

This step emits no issue.
