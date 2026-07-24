# @valchecker/all-steps

The complete built-in Valchecker step collection for custom instances.

```bash
pnpm add @valchecker/all-steps @valchecker/internal
# or
npm install @valchecker/all-steps @valchecker/internal
```

```ts
import { allSteps } from '@valchecker/all-steps'
import { createValchecker } from '@valchecker/internal'

const v = createValcheckker({ steps: allSteps })
const schema = v.string().toTrimmed().isNotEmpty()
```

Most applications should install `valchecker` and use its ready-to-use `v` instance or its re-exported `createValchecker` and `allSteps` APIs. This package is useful when an advanced consumer wants the all-steps collection without the default application instance.

`allSteps` is derived from runtime-marked public plugin exports. It is not a manually maintained duplicate list. The package is ESM-only, requires Node.js 22 or newer, and declares `sideEffects: false`.

See the [Valchecker documentation](https://deviltea.github.io/valchecker/) and the repository [support policy](https://github.com/DevilTea/valchecker/blob/main/SUPPORT.md).
