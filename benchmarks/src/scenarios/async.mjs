// `async/*`: the asynchronous execution path, which nothing in the suite measured
// before — no scenario and no fixture contained an `async` or an `await`. Every
// participant supports asynchronous validation and all three spell it differently,
// which is what these four rows are about.
//
// How each library gets there, read from the four sources and confirmed by
// execution:
//
// - **Valchecker.** Asynchrony belongs to the schema. A `check` or `transform`
//   callback that returns a `PromiseLike` makes the pipeline maybe-async, so
//   `execute` returns a native promise for any input that reaches the callback and a
//   plain result for an input that fails before it. `toAsync()` removes the "maybe"
//   and forces a promise even for a synchronous success. `execute` is unchanged.
// - **Zod.** Asynchrony belongs to the call. An async `refine`/`transform` callback
//   makes the schema parseable only through `safeParseAsync`; a synchronous
//   `safeParse` of one throws (`Async refinement encountered during synchronous
//   parse operation.` on Zod 3, `$ZodAsyncError` on Zod 4).
// - **Valibot.** Both: `pipeAsync` with `checkAsync`/`transformAsync` is the only
//   pipe that can hold an async action, and it must be run through
//   `safeParseAsync`. `safeParse` over one does not throw — it returns a result
//   object built from the still-pending promise, reporting `success: true` with no
//   output — which is a silently wrong answer rather than a comparable one, so it is
//   never used here.
//
// The harness measures these rows by awaiting inside the timed loop. That is the
// measurement rather than an artifact of it: a caller of an asynchronous validation
// cannot avoid the microtask turn that delivers the result, so a callback that
// resolves immediately still pays for one, and the point of comparison is what each
// library costs around that unavoidable turn. Both callbacks therefore resolve
// immediately — `async` with nothing awaited inside — and both come from
// `fixtures.mjs`, so the three libraries await the same function object. A timer
// would measure the timer.
//
// `async/*` rows are in their own benchmark groups (`warm/async/success`,
// `warm/async/failure/library-default`) so no aggregate can average an awaited
// number together with a synchronous one, and each result in `raw.json` carries
// `executionMode: 'async'`.
//
// Two of these rows are meant to be read against an existing synchronous row, and
// only these two:
//
// - `async/wrapper-valid` against `primitive-builtin/valid`. It is the same schema
//   and the same fixture on all five adapters, made asynchronous in the only way
//   each library offers — `toAsync()` on the Valchecker side, `safeParseAsync` on
//   the competitors' — with no asynchronous work anywhere in it. The difference
//   between the two rows is therefore each library's promise machinery and nothing
//   else. Quote both from the same run: one run's environment and sampling budget is
//   what describes both sides.
// - `async/check-valid` against `primitive/valid`, which is the closest synchronous
//   closure predicate in the suite. That pair is much looser — different chain,
//   different predicate — so it bounds the order of magnitude rather than a
//   difference.
//
// Scope. `check-valid`, `check-invalid`, and `transform-valid` are `equivalent`:
// accepted sets, outputs, and the failure position agree exactly on every adapter,
// and the failure reports one issue everywhere. `wrapper-valid` is
// `compatible-subset`, because the two sides reach the promise from opposite places —
// a step inside the schema against a second entry point on the call — and a reader
// should see that stated rather than infer that one API was measured twice.
//
// Not measured. A maybe-async pipeline failing *before* its async callback returns a
// synchronous result on Valchecker while both competitors cannot run the schema
// synchronously at all, so there is no honest cross-library row for it; that
// asymmetry is the mode contract itself and belongs to the focused benchmarks. Async
// structural, union, and intersection scheduling stay out for the reason the
// methodology already gives for intersections: the libraries' ordering and
// short-circuit semantics differ, so a row would compare different work.
import { primitive } from '../fixtures.mjs'
import { warm } from './define.mjs'

// A string of length 2: it passes every adapter's string check and fails the async
// predicate, so the failure belongs to the awaited callback rather than to a type
// check in front of it.
const tooShort = 'ab'

const asyncOptions = { executionMode: 'async' }
const checkSteps = ['string', 'check']
const transformSteps = ['string', 'transform']
const wrapperSteps = ['string', 'isLengthAtLeast', 'isLengthAtMost', 'isMatching', 'toAsync']

export const asyncScenarios = [
	warm('async/check-valid', 'standard', 'asyncCheck', primitive.valid, { success: true, output: primitive.valid }, { ...asyncOptions, steps: checkSteps }),
	warm('async/check-invalid', 'full', 'asyncCheck', tooShort, { success: false }, { ...asyncOptions, steps: checkSteps }),
	warm('async/transform-valid', 'standard', 'asyncTransform', primitive.valid, { success: true, output: `user:${primitive.valid}` }, { ...asyncOptions, steps: transformSteps }),
	warm('async/wrapper-valid', 'standard', 'asyncWrapper', primitive.valid, { success: true, output: primitive.valid }, { ...asyncOptions, comparisonScope: 'compatible-subset', steps: wrapperSteps }),
]
