# Code Style and Conventions

## Code style

- TypeScript strict mode;
- single quotes and no semicolons;
- tabs for indentation;
- type-only imports where applicable;
- functional and immutable-by-replacement patterns;
- `any` only at an explained runtime boundary;
- `/* @__NO_SIDE_EFFECTS__ */` immediately associated with tree-shakable plugin construction.

Follow the surrounding module and existing repository abstractions before introducing another pattern.

## Public step names

- Initial schemas use nouns or noun phrases: `string`, `number`, `object`, `looseNumber`.
- Built-in validations use natural `isXxx` propositions and preserve successful values: `isFinite`, `isAtLeast`, `isStartingWith`.
- Concrete transformations use `toXxx` and describe the resulting representation: `toTrimmed`, `toJSONValue`, `toMappedKeys`.
- Generic and flow-control operations retain direct semantic names: `check`, `transform`, `fallback`, `use`, `generic`, `as`, `toAsync`.

A named validation enforces only its stated condition. Do not hide finite-number, integer, non-empty, parsing, mapping, or coercion policy inside another name. Native conversions retain the corresponding JavaScript operation's semantics; policy-bearing conversions use explicit names.

## Parameters

Message-bearing built-ins follow one contract:

- at most one required semantic operand may be positional;
- optional configuration and `message` use one trailing options object;
- a step with no required operand accepts only an optional options object;
- a required configuration object includes `message` in that same object;
- direct positional messages are forbidden.

```ts
v.number().isAtLeast(0, { message: 'Expected a non-negative number.' })
v.number().isFinite({ message: 'Expected a finite number.' })
v.array(v.number()).toSorted({ compareFn: (a, b) => a - b, message })
```

`scripts/check-step-parameter-style.ts`, run by `pnpm test:quality`, enforces the built-in parameter convention.

## Issue contracts

Issue codes use:

```text
<public-step-name>:<snake_case_description>
```

The method name, `Meta.Name`, `SelfIssue`, runtime `createIssue()` call, category, payload, tests, docs, changelog, and migration material must agree.

Payload keys describe their meaning to a message handler:

- numeric bounds: `minimum`, `maximum`;
- length operands: `minimumLength`, `maximumLength`, `expectedLength`;
- size operands: `minimumSize`, `maximumSize`, `expectedSize`;
- membership/search operands: `expected`;
- callback issues: preserve relevant value/operand, phase, and error;
- serialization issues: preserve nested `at`; operation variants also preserve `error`.

Public categories are:

- `validation`: input or returned negative validation result;
- `operation`: documented user/native work threw or rejected;
- `internal`: unexpected core/plugin execution failure.

Two-argument `ExecutionIssue<Code, Payload>` defaults to `validation`; pass the third category argument for `operation` or `internal`.

## File layout and exports

A normal built-in step has:

```text
packages/internal/src/steps/<name>/
├── <name>.ts
├── <name>.test.ts
├── <name>.bench.ts
└── index.ts
```

Additional type, async, collect-all, or regression tests remain colocated when needed. Export the implementation from its local `index.ts` and from `packages/internal/src/steps/index.ts`.

Intentional public export changes require regenerating `api-surface.json` with `pnpm api:surface:update` and verifying it with `pnpm api:surface`. `allSteps` discovers runtime-marked exports; do not maintain a second list.

## Canonical JSDoc

Every built-in main step's `PluginDef` method uses these headings in order, separated by `---`:

1. `### Description:`
2. `### Example:`
3. `### Issues:`

The example uses current public selective imports. The Issues section lists every issue owned by the method or `None.`. `scripts/check-step-jsdoc.ts`, run by `pnpm test:quality`, checks the main `<dir>/<dir>.ts` file and its `*PluginDef` interface; secondary files such as shorthand helpers are outside that scan.

## Comments and performance

Explain why a non-obvious design exists. Do not restate direct code. A performance comment or deliberate duplication must point to reproducible benchmark/profiling evidence and preserve the exact semantic contract measured.
