<!-- step-doc
category: helpers
section: flow-control
summary: recover earlier validation and operation failures; internal issues are fatal
-->

### `fallback(getValue, options?)`

`fallback()` recovers earlier `validation` and `operation` failures in the current pipeline by
supplying a replacement value. An `internal` issue is fatal and bypasses the fallback callback.

```ts
const safeNumber = v.number()
	.isAtLeast(0)
	.fallback(() => 0)

safeNumber.execute(-5) // { value: 0 }
safeNumber.execute('invalid') // { value: 0 }
```

The fallback result must be assignable to the pipeline's current output type. It may be direct or
`PromiseLike`; a callback whose return type is definitely synchronous keeps a synchronous type-level
mode, while a promise-like result makes the schema maybe-async.

```ts
const config = v.string()
	.toJSONValue()
	.fallback(() => ({ items: [], count: 0 }))
```

If the callback itself throws or rejects, the received issues are kept and one more issue is
appended.

**Issue code:** `fallback:failed` (`operation`) — the fallback callback threw or rejected. Payload
`{ receivedIssues, error }`, where `receivedIssues` is a defensive structural snapshot of the
failure the callback was given and `error` is what it threw. The snapshot detaches Valchecker-owned
issue records, paths, context records, payload records, and nested diagnostic containers declared by
their owning protocol. It is intentionally not a generic deep clone: opaque/user-owned payload
values such as objects, arrays, `Error`, `Date`, collections, callbacks, proxies, and schema
references keep their identity. Snapshot issues carry the unresolved step-default message rather
than the finalized one; the issues returned to the caller finalize normally.
