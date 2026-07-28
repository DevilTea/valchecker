# Conventions

Code style, the `isXxx`/`toXxx`/noun naming rules, the trailing-options-object contract, and the issue-code format are in [`AGENTS.md`](../../../../AGENTS.md). This file holds the detail behind them: concrete naming examples, the payload key vocabulary, categories, and canonical JSDoc. What a step directory holds and how `<name>.ts` is laid out is [the step unit](./step-unit.md).

## Naming examples

| Kind | Examples |
| --- | --- |
| Initial schema (noun) | `string`, `number`, `object`, `looseNumber` |
| Validation (`isXxx`, value preserved) | `isFinite`, `isAtLeast`, `isStartingWith` |
| Transformation (`toXxx`, names the result) | `toTrimmed`, `toJSONValue`, `toMappedKeys` |
| Generic / flow control | `check`, `transform`, `fallback`, `use`, `generic`, `as`, `toAsync` |

Do not hide finite-number, integer, non-empty, parsing, mapping, or coercion policy inside another name.

## Parameters

Beyond the rule in `AGENTS.md`: a step with no required operand accepts only an optional options object, and a required configuration object includes `message` in that same object.

```ts
v.number().isAtLeast(0, { message: 'Expected a non-negative number.' })
v.number().isFinite({ message: 'Expected a finite number.' })
v.array(v.number()).toSorted({ compareFn: (a, b) => a - b, message })
```

## Issue contracts

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

## Canonical JSDoc

Every built-in main step's `PluginDef` method uses these headings in order, separated by `---`:

1. `### Description:`
2. `### Example:`
3. `### Issues:`

The example uses current public selective imports. The Issues section lists every issue owned by the method or `None.`. `scripts/check-step-jsdoc.ts`, run by `pnpm test:quality`, checks the main `<dir>/<dir>.ts` file and its `*PluginDef` interface; secondary files such as shorthand helpers are outside that scan.

## Comments and performance

Explain why a non-obvious design exists. Do not restate direct code. A performance comment or deliberate duplication must point to reproducible benchmark/profiling evidence and preserve the exact semantic contract measured.
