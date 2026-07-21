from pathlib import Path

path = Path('packages/internal/src/core/core.ts')
content = path.read_text()

replacements = [
    (
        "import type { ExecutionEffects } from './execution-effects'\nimport { conservativeExecutionEffects, executionEffectsKey, neutralExecutionEffects } from './execution-effects'",
        "import type { ExecutionEffects, ExecutionEffectsResolver } from './execution-effects'\nimport { conservativeExecutionEffects, getStepPluginExecutionEffects, neutralExecutionEffects } from './execution-effects'",
    ),
    (
        """type RuntimeStepMethodUtils = StepMethodUtils<any, any, any, any> & {
\t'~operationMode': RuntimeOperationMode
\t'~previousExecutionEffects': ExecutionEffects
\t'~executionEffects': ExecutionEffects
}

interface RegisteredStepMethod {
\trun: AnyFn
\tdefaultOperationMode: RuntimeOperationMode
}
""",
        """type RuntimeStepMethodUtils = StepMethodUtils<any, any, any, any> & {
\t'~operationMode': RuntimeOperationMode
}

interface RegisteredStepMethod {
\trun: AnyFn
\tdefaultOperationMode: RuntimeOperationMode
\tresolveExecutionEffects?: ExecutionEffectsResolver | undefined
}
""",
    ),
    (
        """function createExecutionStepMethodUtils(
\tmethod: string,
\truntimeExecutions: RuntimeStep[],
\tresolveMessage: ResolveMessageFn,
\tcurrentOperationMode: RuntimeOperationMode,
\tcurrentExecutionEffects: ExecutionEffects,
\tdefaultOperationMode: RuntimeOperationMode,
): RuntimeStepMethodUtils {
""",
        """function createExecutionStepMethodUtils(
\tmethod: string,
\truntimeExecutions: RuntimeStep[],
\tresolveMessage: ResolveMessageFn,
\tcurrentOperationMode: RuntimeOperationMode,
\tdefaultOperationMode: RuntimeOperationMode,
): RuntimeStepMethodUtils {
""",
    ),
    (
        """\tconst utils: RuntimeStepMethodUtils = {
\t\t'~operationMode': currentOperationMode,
\t\t'~previousExecutionEffects': currentExecutionEffects,
\t\t'~executionEffects': conservativeExecutionEffects,
\t\taddStep: (fn, operationMode) => {
""",
        """\tconst utils: RuntimeStepMethodUtils = {
\t\t'~operationMode': currentOperationMode,
\t\taddStep: (fn, operationMode) => {
""",
    ),
    (
        """\t\t\tconst runtimeSteps: RuntimeStep[] = []
\t\t\tconst utils = createExecutionStepMethodUtils(
\t\t\t\tmethod,
\t\t\t\truntimeSteps,
\t\t\t\tresolveMessage,
\t\t\t\tRUNTIME_OPERATION_MODE_SYNC,
\t\t\t\tconservativeExecutionEffects,
\t\t\t\tregisteredStepMethod.defaultOperationMode,
\t\t\t)
\t\t\tregisteredStepMethod.run({
\t\t\t\tutils,
\t\t\t\tparams: [...params],
\t\t\t\tcontext,
\t\t\t})
\t\t\treturn createInstance({
\t\t\t\tstepMethods,
\t\t\t\tresolveMessage,
\t\t\t\tcontext,
\t\t\t\tcurrentRuntimeSteps: runtimeSteps,
\t\t\t\tcurrentOperationMode: utils['~operationMode'],
\t\t\t\tcurrentExecutionEffects: utils['~executionEffects'],
\t\t\t})
""",
        """\t\t\tconst runtimeSteps: RuntimeStep[] = []
\t\t\tconst methodParams = [...params]
\t\t\tconst utils = createExecutionStepMethodUtils(
\t\t\t\tmethod,
\t\t\t\truntimeSteps,
\t\t\t\tresolveMessage,
\t\t\t\tRUNTIME_OPERATION_MODE_SYNC,
\t\t\t\tregisteredStepMethod.defaultOperationMode,
\t\t\t)
\t\t\tregisteredStepMethod.run({
\t\t\t\tutils,
\t\t\t\tparams: methodParams,
\t\t\t\tcontext,
\t\t\t})
\t\t\tconst executionEffects = registeredStepMethod.resolveExecutionEffects?.(
\t\t\t\tneutralExecutionEffects,
\t\t\t\tmethodParams,
\t\t\t) ?? conservativeExecutionEffects
\t\t\treturn createInstance({
\t\t\t\tstepMethods,
\t\t\t\tresolveMessage,
\t\t\t\tcontext,
\t\t\t\tcurrentRuntimeSteps: runtimeSteps,
\t\t\t\tcurrentOperationMode: utils['~operationMode'],
\t\t\t\tcurrentExecutionEffects: executionEffects,
\t\t\t})
""",
    ),
    (
        """\t\t\t\tconst utils = createExecutionStepMethodUtils(
\t\t\t\t\tp as string,
\t\t\t\t\tnextRuntimeSteps,
\t\t\t\t\tresolveMessage,
\t\t\t\t\toperationMode,
\t\t\t\t\texecutionEffects,
\t\t\t\t\tregisteredStepMethod.defaultOperationMode,
\t\t\t\t)
\t\t\t\tregisteredStepMethod.run({
\t\t\t\t\tutils,
\t\t\t\t\tparams,
\t\t\t\t\tcontext,
\t\t\t\t})
\t\t\t\treturn createInstance({
\t\t\t\t\tstepMethods,
\t\t\t\t\tresolveMessage,
\t\t\t\t\tcontext,
\t\t\t\t\tcurrentRuntimeSteps: nextRuntimeSteps,
\t\t\t\t\tcurrentOperationMode: utils['~operationMode'],
\t\t\t\t\tcurrentExecutionEffects: utils['~executionEffects'],
\t\t\t\t})
""",
        """\t\t\t\tconst utils = createExecutionStepMethodUtils(
\t\t\t\t\tp as string,
\t\t\t\t\tnextRuntimeSteps,
\t\t\t\t\tresolveMessage,
\t\t\t\t\toperationMode,
\t\t\t\t\tregisteredStepMethod.defaultOperationMode,
\t\t\t\t)
\t\t\t\tregisteredStepMethod.run({
\t\t\t\t\tutils,
\t\t\t\t\tparams,
\t\t\t\t\tcontext,
\t\t\t\t})
\t\t\t\tconst nextExecutionEffects = registeredStepMethod.resolveExecutionEffects?.(
\t\t\t\t\texecutionEffects,
\t\t\t\t\tparams,
\t\t\t\t) ?? conservativeExecutionEffects
\t\t\t\treturn createInstance({
\t\t\t\t\tstepMethods,
\t\t\t\t\tresolveMessage,
\t\t\t\t\tcontext,
\t\t\t\t\tcurrentRuntimeSteps: nextRuntimeSteps,
\t\t\t\t\tcurrentOperationMode: utils['~operationMode'],
\t\t\t\t\tcurrentExecutionEffects: nextExecutionEffects,
\t\t\t\t})
""",
    ),
    (
        """\treturn {
\t\t[executionEffectsKey]: executionEffects,
\t\t'~standard': {
""",
        """\treturn {
\t\t'~standard': {
""",
    ),
    (
        """\t\t'~core': {
\t\t\texecutionStepContext: null!,
\t\t\tRegisteredStepPluginDefs: null!,
\t\t\truntimeSteps,
\t\t\toperationMode: OPERATION_MODES[operationMode],
\t\t},
""",
        """\t\t'~core': {
\t\t\texecutionStepContext: null!,
\t\t\tRegisteredStepPluginDefs: null!,
\t\t\truntimeSteps,
\t\t\toperationMode: OPERATION_MODES[operationMode],
\t\t\texecutionEffects,
\t\t},
""",
    ),
    (
        """\tfor (const def of steps) {
\t\tconst defaultOperationMode = (def as any)[stepPluginDefaultOperationMode] ?? RUNTIME_OPERATION_MODE_MAYBE_ASYNC
\t\tfor (const method of Reflect.ownKeys(def)) {
""",
        """\tfor (const def of steps) {
\t\tconst defaultOperationMode = (def as any)[stepPluginDefaultOperationMode] ?? RUNTIME_OPERATION_MODE_MAYBE_ASYNC
\t\tconst executionEffectsResolvers = getStepPluginExecutionEffects(def)
\t\tfor (const method of Reflect.ownKeys(def)) {
""",
    ),
    (
        "\t\t\tstepMethods[method] = { run: stepMethod, defaultOperationMode }\n",
        """\t\t\tstepMethods[method] = {
\t\t\t\trun: stepMethod,
\t\t\t\tdefaultOperationMode,
\t\t\t\tresolveExecutionEffects: executionEffectsResolvers?.[method],
\t\t\t}
""",
    ),
]

for old, new in replacements:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one replacement, found {count}: {old[:120]!r}')
    content = content.replace(old, new, 1)

path.write_text(content)
