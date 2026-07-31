<!-- step-doc
category: structures
section: instances
summary: a `File`, through a feature-detected global
-->

### `file(options?)`

Checks that the value is a `File`, preserving the value and inferring the `File` output type.

The global `File` constructor is feature-detected. In an environment without `File` (such as some
server runtimes), the schema fails with its owned issue instead of throwing.

```ts
const avatar = v.file()

avatar.execute(new File(['data'], 'a.png')) // success
avatar.execute('a.png') // failure
```

Size validation reuses the collection size steps because `File` and `Blob` expose a numeric `size`:

```ts
v.file()
	.isSizeAtMost(5 * 1024 * 1024) // at most 5 MiB
```

**Issue code:** `file:expected_file` — the value is not a `File`. Payload `{ value }`.
