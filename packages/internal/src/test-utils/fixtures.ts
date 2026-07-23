import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	InferOutput,
	Next,
	TStepMethodMeta,
	TStepPluginDef,
} from '../core'
import { implStepPlugin } from '../core'

// Shared, well-typed step-plugin fixtures for tests. These replace the
// per-file `implStepPlugin<any>` fixtures, whose `any` def collapsed the whole
// instance type to `InitialValchecker<any>` (no step methods). Their observable
// runtime behavior is identical to the copies they replace.

type InternalFailureMeta = DefineStepMethodMeta<{
	Name: 'internalFailure'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

type AsyncInternalFailureMeta = DefineStepMethodMeta<{
	Name: 'asyncInternalFailure'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

type ObserveMeta = DefineStepMethodMeta<{
	Name: 'observe'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface StructuralFixtureDef extends TStepPluginDef {
	/** Registers a synchronous success step that throws, forcing an internal failure. */
	internalFailure: DefineStepMethod<
		InternalFailureMeta,
		this['CurrentValchecker'] extends infer This extends InternalFailureMeta['ExpectedCurrentValchecker']
			? () => Next<undefined, This>
			: never
	>
	/** Registers an asynchronous success step that throws, forcing an internal failure. */
	asyncInternalFailure: DefineStepMethod<
		AsyncInternalFailureMeta,
		this['CurrentValchecker'] extends infer This extends AsyncInternalFailureMeta['ExpectedCurrentValchecker']
			? () => Next<undefined, This>
			: never
	>
	/** Registers a pass-through success step that reports each observed value. */
	observe: DefineStepMethod<
		ObserveMeta,
		this['CurrentValchecker'] extends infer This extends ObserveMeta['ExpectedCurrentValchecker']
			? (callback: (value: InferOutput<This>) => void) => Next<undefined, This>
			: never
	>
}

/**
 * The common structural test fixture: `internalFailure`, `asyncInternalFailure`
 * and `observe`. Included in `createValchecker` step arrays by tests that probe
 * child-failure and observation semantics of structural steps.
 */
export const structuralFixture = implStepPlugin<StructuralFixtureDef>({
	internalFailure: ({ utils }) => {
		utils.addSuccessStep(() => {
			throw new Error('internal failure')
		})
	},
	asyncInternalFailure: ({ utils }) => {
		utils.addSuccessStep(async () => {
			throw new Error('async internal failure')
		})
	},
	observe: ({ utils, params: [callback] }) => {
		utils.addSuccessStep((value) => {
			callback(value)
			return utils.success(value)
		})
	},
})

type SyncMapMeta = DefineStepMethodMeta<{
	Name: 'syncMap'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface SyncProcessMeta extends TStepMethodMeta {
	Name: 'syncProcess'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'fixture:rejected', { value: unknown }>
}

interface SyncTransformFixtureDef extends TStepPluginDef {
	/** Registers a synchronous mapping success step. */
	syncMap: DefineStepMethod<
		SyncMapMeta,
		this['CurrentValchecker'] extends infer This extends SyncMapMeta['ExpectedCurrentValchecker']
			? <Output>(run: (value: InferOutput<This>) => Output) => Next<{ output: Output, operationMode: 'sync' }, This>
			: never
	>
	/** Registers a synchronous success step that maps or rejects the value. */
	syncProcess: DefineStepMethod<
		SyncProcessMeta,
		this['CurrentValchecker'] extends infer This extends SyncProcessMeta['ExpectedCurrentValchecker']
			? <Output>(
					run: (value: InferOutput<This>) => { ok: true, value: Output } | { ok: false },
				) => Next<{ output: Output, operationMode: 'sync', issue: SyncProcessMeta['SelfIssue'] }, This>
			: never
	>
}

/**
 * Synchronous transform fixtures (`syncMap`, `syncProcess`) used by lazy-output
 * and native-snapshot tests to exercise identity-preserving success paths.
 */
export const syncTransformFixture = implStepPlugin<SyncTransformFixtureDef>({
	syncMap: ({ utils, params: [run] }) => {
		utils.addSuccessStep(value => utils.success(run(value)), 'sync')
	},
	syncProcess: ({ utils, params: [run] }) => {
		utils.addSuccessStep((value) => {
			const result = run(value)
			return result.ok
				? utils.success(result.value)
				: utils.failure(utils.createIssue({
						code: 'fixture:rejected',
						payload: { value },
						defaultMessage: 'Rejected by fixture.',
					}))
		}, 'sync')
	},
}, 'sync')
