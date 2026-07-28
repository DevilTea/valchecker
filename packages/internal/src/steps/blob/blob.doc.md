<!-- step-doc
category: structures
section: instances
summary: a `Blob`, through a feature-detected global
-->

### `blob(options?)`

Checks that the value is a `Blob`, preserving the value and inferring the `Blob` output type. Every
`File` is also a `Blob`, so `blob()` accepts both.

The global `Blob` constructor is feature-detected. In an environment without `Blob` (such as some
server runtimes), the schema fails with its owned issue instead of throwing.

```ts
const upload = v.blob()

upload.execute(new Blob(['data'])) // success
upload.execute(new File(['data'], 'a.png')) // success
upload.execute('a.png') // failure
```

**Issue code:** `blob:expected_blob` — the value is not a `Blob`. Payload `{ value }`.
