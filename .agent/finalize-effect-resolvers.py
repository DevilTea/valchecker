from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    content = file.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {old[:120]!r}')
    file.write_text(content.replace(old, new, 1))


execution_effects = 'packages/internal/src/core/execution-effects.ts'
replace_once(
    execution_effects,
    """export type ExecutionEffectsResolver = (
\tprevious: ExecutionEffects,
\tparams: readonly unknown[],
) => ExecutionEffects
""",
    """export type ExecutionEffectsResolver = (
\tprevious: ExecutionEffects,
\tparams: readonly unknown[],
\tstepMetadata: unknown,
) => ExecutionEffects
""",
)
replace_once(
    execution_effects,
    """interface SchemaWithExecutionEffects {
\treadonly '~core'?: {
\t\treadonly executionEffects?: ExecutionEffects | undefined
\t} | undefined
}
""",
    """export const executionEffectsKey = Symbol('valchecker.executionEffects')

interface SchemaWithExecutionEffects {
\treadonly '~core'?: {
\t\treadonly [executionEffectsKey]?: ExecutionEffects | undefined
\t} | undefined
}
""",
)
replace_once(
    execution_effects,
    "return (schema as SchemaWithExecutionEffects)['~core']?.executionEffects ?? conservativeExecutionEffects",
    "return (schema as SchemaWithExecutionEffects)['~core']?.[executionEffectsKey] ?? conservativeExecutionEffects",
)

core = 'packages/internal/src/core/core.ts'
replace_once(
    core,
    "import { conservativeExecutionEffects, getStepPluginExecutionEffects, neutralExecutionEffects } from './execution-effects'",
    "import { conservativeExecutionEffects, executionEffectsKey, getStepPluginExecutionEffects, neutralExecutionEffects } from './execution-effects'",
)
replace_once(
    core,
    """\t\t\tregisteredStepMethod.run({
\t\t\t\tutils,
\t\t\t\tparams: methodParams,
\t\t\t\tcontext,
\t\t\t})
\t\t\tconst executionEffects = registeredStepMethod.resolveExecutionEffects?.(
\t\t\t\tneutralExecutionEffects,
\t\t\t\tmethodParams,
\t\t\t) ?? conservativeExecutionEffects
""",
    """\t\t\tconst stepMetadata = registeredStepMethod.run({
\t\t\t\tutils,
\t\t\t\tparams: methodParams,
\t\t\t\tcontext,
\t\t\t})
\t\t\tconst executionEffects = registeredStepMethod.resolveExecutionEffects?.(
\t\t\t\tneutralExecutionEffects,
\t\t\t\tmethodParams,
\t\t\t\tstepMetadata,
\t\t\t) ?? conservativeExecutionEffects
""",
)
replace_once(
    core,
    """\t\t\t\tregisteredStepMethod.run({
\t\t\t\t\tutils,
\t\t\t\t\tparams,
\t\t\t\t\tcontext,
\t\t\t\t})
\t\t\t\tconst nextExecutionEffects = registeredStepMethod.resolveExecutionEffects?.(
\t\t\t\t\texecutionEffects,
\t\t\t\t\tparams,
\t\t\t\t) ?? conservativeExecutionEffects
""",
    """\t\t\t\tconst stepMetadata = registeredStepMethod.run({
\t\t\t\t\tutils,
\t\t\t\t\tparams,
\t\t\t\t\tcontext,
\t\t\t\t})
\t\t\t\tconst nextExecutionEffects = registeredStepMethod.resolveExecutionEffects?.(
\t\t\t\t\texecutionEffects,
\t\t\t\t\tparams,
\t\t\t\t\tstepMetadata,
\t\t\t\t) ?? conservativeExecutionEffects
""",
)
replace_once(
    core,
    "\t\t\texecutionEffects,\n\t\t},\n\t\t'~execute': executeRaw,",
    "\t\t\t[executionEffectsKey]: executionEffects,\n\t\t},\n\t\t'~execute': executeRaw,",
)

object_path = 'packages/internal/src/steps/object/object.ts'
replace_once(
    object_path,
    """function setOutputValue(output: Record<PropertyKey, any>, key: PropertyKey, value: unknown): void {
""",
    """interface ObjectExecutionEffectsMetadata {
\treadonly keys: readonly PropertyKey[]
\treadonly childrenAreDirectSafe: boolean
}

function setOutputValue(output: Record<PropertyKey, any>, key: PropertyKey, value: unknown): void {
""",
)
replace_once(
    object_path,
    """\t\tlet operationMode: OperationMode = 'sync'
\t\tconst propsMeta: PropMeta[] = []
""",
    """\t\tlet operationMode: OperationMode = 'sync'
\t\tlet childrenAreDirectSafe = true
\t\tconst propsMeta: PropMeta[] = []
""",
)
replace_once(
    object_path,
    """\t\t\tpropsMeta.push({ key, isOptional, execute: schema['~execute'] })
\t\t\tif (schema['~core']?.operationMode !== 'sync')
\t\t\t\toperationMode = 'maybe-async'
\t\t}
""",
    """\t\t\tpropsMeta.push({ key, isOptional, execute: schema['~execute'] })
\t\t\tif (schema['~core']?.operationMode !== 'sync')
\t\t\t\toperationMode = 'maybe-async'
\t\t\tif (getExecutionEffects(schema).parentTraversal !== 'direct-safe')
\t\t\t\tchildrenAreDirectSafe = false
\t\t}
""",
)
replace_once(
    object_path,
    """\t\t}, operationMode)
\t},
}), {
\tobject: (previous, [struct]) => {
\t\tconst keys = getEnumerableOwnKeys(struct as Record<PropertyKey, unknown>)
\t\tlet parentTraversal = previous.parentTraversal
\t\tfor (let i = 0; i < keys.length; i++) {
\t\t\tconst prop = (struct as Record<PropertyKey, any>)[keys[i]!]!
\t\t\tconst schema = Array.isArray(prop) ? prop[0]! : prop
\t\t\tif (getExecutionEffects(schema).parentTraversal !== 'direct-safe') {
\t\t\t\tparentTraversal = 'snapshot-required'
\t\t\t\tbreak
\t\t\t}
\t\t}
\t\treturn {
\t\t\tidentity: 'may-transform',
\t\t\tparentTraversal,
\t\t\tstructuralOutput: { kind: 'fresh-ordinary-object', keys },
\t\t}
\t},
})""",
    """\t\t}, operationMode)
\t\treturn { keys, childrenAreDirectSafe }
\t},
}), {
\tobject: (previous, _params, stepMetadata) => {
\t\tconst { keys, childrenAreDirectSafe } = stepMetadata as ObjectExecutionEffectsMetadata
\t\treturn {
\t\t\tidentity: 'may-transform',
\t\t\tparentTraversal: previous.parentTraversal === 'direct-safe' && childrenAreDirectSafe
\t\t\t\t? 'direct-safe'
\t\t\t\t: 'snapshot-required',
\t\t\tstructuralOutput: { kind: 'fresh-ordinary-object', keys },
\t\t}
\t},
})""",
)
