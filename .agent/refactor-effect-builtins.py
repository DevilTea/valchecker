from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    content = file.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {old[:100]!r}')
    file.write_text(content.replace(old, new, 1))


for name in ['string', 'number', 'boolean', 'bigint']:
    path = f'packages/internal/src/steps/{name}/{name}.ts'
    replace_once(
        path,
        "import { preserveExecutionEffects } from '../../core/execution-effects'",
        "import { withExecutionEffects } from '../../core/execution-effects'",
    )
    replace_once(path, '\t\tpreserveExecutionEffects(utils)\n', '')
    replace_once(
        path,
        f'export const {name} = implStepPlugin<PluginDef>({{',
        f'export const {name} = withExecutionEffects(implStepPlugin<PluginDef>({{',
    )
    replace_once(
        path,
        "}, 'sync')\n",
        f"}}, 'sync'), {{ {name}: previous => previous }})\n",
    )

check_path = 'packages/internal/src/steps/check/check.ts'
replace_once(
    check_path,
    "import { preserveExecutionEffects } from '../../core/execution-effects'",
    "import { preserveExecutionEffects, withExecutionEffects } from '../../core/execution-effects'",
)
replace_once(
    check_path,
    'export const check = implStepPlugin<PluginDef>({',
    'export const check = withExecutionEffects(implStepPlugin<PluginDef>({',
)
replace_once(
    check_path,
    """\t\tpreserveExecutionEffects(utils, {
\t\t\tparentTraversal: 'snapshot-required',
\t\t\tstructuralOutput: null,
\t\t})
""",
    '',
)
replace_once(
    check_path,
    "\t},\n})",
    """\t},
}), {
\tcheck: previous => preserveExecutionEffects(previous, {
\t\tparentTraversal: 'snapshot-required',
\t\tstructuralOutput: null,
\t}),
})""",
)

transform_path = 'packages/internal/src/steps/transform/transform.ts'
replace_once(
    transform_path,
    "import { setExecutionEffects } from '../../core/execution-effects'",
    "import { conservativeExecutionEffects, withExecutionEffects } from '../../core/execution-effects'",
)
replace_once(
    transform_path,
    'export const transform = implStepPlugin<PluginDef>({',
    'export const transform = withExecutionEffects(implStepPlugin<PluginDef>({',
)
replace_once(
    transform_path,
    """\t\tsetExecutionEffects(utils, {
\t\t\tidentity: 'may-transform',
\t\t\tparentTraversal: 'snapshot-required',
\t\t\tstructuralOutput: null,
\t\t})
""",
    '',
)
replace_once(
    transform_path,
    "\t},\n})",
    "\t},\n}), { transform: () => conservativeExecutionEffects })",
)

object_path = 'packages/internal/src/steps/object/object.ts'
replace_once(
    object_path,
    "import { getExecutionEffects, getPreviousExecutionEffects, setExecutionEffects } from '../../core/execution-effects'",
    "import { getExecutionEffects, withExecutionEffects } from '../../core/execution-effects'",
)
replace_once(
    object_path,
    """function setOutputValue(output: Record<PropertyKey, any>, key: PropertyKey, value: unknown): void {
""",
    """function getEnumerableOwnKeys(value: Record<PropertyKey, unknown>): PropertyKey[] {
\tconst keys: PropertyKey[] = Object.keys(value)
\tconst symbols = Object.getOwnPropertySymbols(value)
\tfor (let i = 0; i < symbols.length; i++) {
\t\tconst key = symbols[i]!
\t\tif (Object.prototype.propertyIsEnumerable.call(value, key))
\t\t\tkeys.push(key)
\t}
\treturn keys
}

function setOutputValue(output: Record<PropertyKey, any>, key: PropertyKey, value: unknown): void {
""",
)
replace_once(
    object_path,
    'export const object = implStepPlugin<PluginDef>({',
    'export const object = withExecutionEffects(implStepPlugin<PluginDef>({',
)
replace_once(
    object_path,
    """\t\tconst keys: PropertyKey[] = Object.keys(struct)
\t\tconst symbols = Object.getOwnPropertySymbols(struct)
\t\tfor (let i = 0; i < symbols.length; i++) {
\t\t\tconst key = symbols[i]!
\t\t\tif (Object.prototype.propertyIsEnumerable.call(struct, key))
\t\t\t\tkeys.push(key)
\t\t}
""",
    "\t\tconst keys = getEnumerableOwnKeys(struct)\n",
)
replace_once(
    object_path,
    """\t\tlet operationMode: OperationMode = 'sync'
\t\tlet parentTraversal = getPreviousExecutionEffects(utils).parentTraversal
\t\tconst propsMeta: PropMeta[] = []
""",
    """\t\tlet operationMode: OperationMode = 'sync'
\t\tconst propsMeta: PropMeta[] = []
""",
)
replace_once(
    object_path,
    """\t\t\tif (schema['~core']?.operationMode !== 'sync')
\t\t\t\toperationMode = 'maybe-async'
\t\t\tif (getExecutionEffects(schema).parentTraversal !== 'direct-safe')
\t\t\t\tparentTraversal = 'snapshot-required'
\t\t}
\t\tsetExecutionEffects(utils, {
\t\t\tidentity: 'may-transform',
\t\t\tparentTraversal,
\t\t\tstructuralOutput: { kind: 'fresh-ordinary-object', keys: [...keys] },
\t\t})

""",
    """\t\t\tif (schema['~core']?.operationMode !== 'sync')
\t\t\t\toperationMode = 'maybe-async'
\t\t}

""",
)
replace_once(
    object_path,
    "\t},\n})",
    """\t},
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
)

# Refactor the test-only partial-preservation plugin to use registration metadata.
test_path = 'packages/internal/src/core/execution-effects.test.ts'
replace_once(
    test_path,
    "import { conservativeExecutionEffects, getExecutionEffects, neutralExecutionEffects, preserveExecutionEffects } from './execution-effects'",
    "import { conservativeExecutionEffects, getExecutionEffects, neutralExecutionEffects, preserveExecutionEffects, withExecutionEffects } from './execution-effects'",
)
replace_once(
    test_path,
    """const preserveIdentityOnly = implStepPlugin({
\tpreserveIdentityOnly: ({ utils }: any) => {
\t\tpreserveExecutionEffects(utils, { identity: 'may-transform' })
\t\tutils.addStep((result: ExecutionResult) => result, 'sync')
\t},
} as any) as StepPluginImpl<TStepPluginDef>
""",
    """const preserveIdentityOnly = withExecutionEffects(
\timplStepPlugin({
\t\tpreserveIdentityOnly: ({ utils }: any) => {
\t\t\tutils.addStep((result: ExecutionResult) => result, 'sync')
\t\t},
\t} as any) as StepPluginImpl<TStepPluginDef>,
\t{ preserveIdentityOnly: previous => preserveExecutionEffects(previous, { identity: 'may-transform' }) },
)
""",
)
