from pathlib import Path
import re
import subprocess

BASE = '3019a0d36972aafd0d8a4f2f5105bbe2b3a077e5'


def run(*args: str) -> None:
    print('+', ' '.join(args), flush=True)
    subprocess.run(args, check=True)


def sub_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{label}: expected one replacement, found {count}')
    print(f'patched {label}', flush=True)
    return result


run('git', 'fetch', 'origin', BASE, '--depth=1')
run(
    'git', 'checkout', BASE, '--',
    'packages/internal/src/core/core.ts',
    'packages/internal/src/steps/bigint/bigint.ts',
    'packages/internal/src/steps/boolean/boolean.ts',
    'packages/internal/src/steps/check/check.ts',
    'packages/internal/src/steps/intersection/intersection.ts',
    'packages/internal/src/steps/number/number.ts',
    'packages/internal/src/steps/object/object.ts',
    'packages/internal/src/steps/string/string.ts',
    'packages/internal/src/steps/transform/transform.ts',
)

for target in (
    'packages/internal/src/core/execution-effects.ts',
    'packages/internal/src/core/execution-effects.test.ts',
    'packages/internal/src/steps/intersection/static-plan.test.ts',
):
    Path(target).unlink(missing_ok=True)

Path('packages/internal/src/core/runtime-traits.ts').write_text("""import type { StepPluginImpl, Valchecker } from './types'

const identityRuntimeStepPlugins = new WeakSet<object>()

export function markIdentityRuntimeStepPlugin<Plugin extends StepPluginImpl<any>>(
\tplugin: Plugin,
): Plugin {
\tidentityRuntimeStepPlugins.add(plugin)
\treturn plugin
}

export function isIdentityRuntimeStepPlugin(plugin: StepPluginImpl<any>): boolean {
\treturn identityRuntimeStepPlugins.has(plugin)
}

export function hasIdentityOnlyRuntimeSteps(schema: Valchecker): boolean {
\tconst runtimeSteps = schema['~core']?.runtimeSteps
\tif (runtimeSteps == null || runtimeSteps.length === 0)
\t\treturn false

\tfor (let index = 0; index < runtimeSteps.length; index++) {
\t\tif (!Object.hasOwn(runtimeSteps[index]!, 'prototype'))
\t\t\treturn false
\t}
\treturn true
}
""")
print('wrote runtime-traits.ts', flush=True)

core = Path('packages/internal/src/core/core.ts')
text = core.read_text()
text = sub_once(
    text,
    r"(import \{ isPromiseLike, runtimeExecutionStepDefMarker \} from '../shared'\n)",
    r"\1import { isIdentityRuntimeStepPlugin } from './runtime-traits'\n",
    'core trait import',
)
text = sub_once(
    text,
    r"interface RegisteredStepMethod \{\n\trun: AnyFn\n\tdefaultOperationMode: RuntimeOperationMode\n\}",
    "interface RegisteredStepMethod {\n\trun: AnyFn\n\tdefaultOperationMode: RuntimeOperationMode\n\tidentityRuntimeSteps: boolean\n}",
    'registered method trait',
)
text = sub_once(
    text,
    r"(function createExecutionStepMethodUtils\([\s\S]*?\tdefaultOperationMode: RuntimeOperationMode,)\n(\): RuntimeStepMethodUtils \{)",
    r"\1\n\tidentityRuntimeSteps: boolean,\n\2",
    'utils signature',
)
wrapper_start = """\tconst wrapWithErrorHandling = (
\t\tfn: (lastResult: ExecutionResult) => MaybePromiseLike<ExecutionResult>,
\t\toperationMode: RuntimeOperationMode,
\t): RuntimeStep => {
"""
identity_block = wrapper_start + """\t\tif (identityRuntimeSteps) {
\t\t\tif (operationMode === RUNTIME_OPERATION_MODE_SYNC) {
\t\t\t\treturn function identityRuntimeStep(lastResult) {
\t\t\t\t\ttry {
\t\t\t\t\t\treturn fn(lastResult) as ExecutionResult
\t\t\t\t\t}
\t\t\t\t\tcatch (error) {
\t\t\t\t\t\treturn createUnknownExceptionFailure(method, lastResult, error, resolveMessage)
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}

\t\t\tif (operationMode === RUNTIME_OPERATION_MODE_ASYNC) {
\t\t\t\treturn function identityRuntimeStep(lastResult) {
\t\t\t\t\ttry {
\t\t\t\t\t\treturn Promise.resolve(fn(lastResult)).catch(
\t\t\t\t\t\t\terror => createUnknownExceptionFailure(method, lastResult, error, resolveMessage),
\t\t\t\t\t\t)
\t\t\t\t\t}
\t\t\t\t\tcatch (error) {
\t\t\t\t\t\treturn Promise.resolve(createUnknownExceptionFailure(method, lastResult, error, resolveMessage))
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}

\t\t\treturn function identityRuntimeStep(lastResult) {
\t\t\t\ttry {
\t\t\t\t\tconst result = fn(lastResult)
\t\t\t\t\treturn isPromiseLike(result)
\t\t\t\t\t\t? Promise.resolve(result).catch(error => createUnknownExceptionFailure(method, lastResult, error, resolveMessage))
\t\t\t\t\t\t: result
\t\t\t\t}
\t\t\t\tcatch (error) {
\t\t\t\t\treturn createUnknownExceptionFailure(method, lastResult, error, resolveMessage)
\t\t\t\t}
\t\t\t}
\t\t}

"""
if text.count(wrapper_start) != 1:
    raise RuntimeError(f'identity wrapper insertion: found {text.count(wrapper_start)} starts')
text = text.replace(wrapper_start, identity_block, 1)
print('patched identity wrapper insertion', flush=True)
text, count = re.subn(
    r"(registeredStepMethod\.defaultOperationMode,)(\n\s*\))",
    r"\1\n\t\t\t\tregisteredStepMethod.identityRuntimeSteps,\2",
    text,
)
if count != 2:
    raise RuntimeError(f'core utils call sites: expected 2, found {count}')
print('patched core utils call sites', flush=True)
text = sub_once(
    text,
    r"(\tfor \(const def of steps\) \{\n\t\tconst defaultOperationMode = .*?\n)(\t\tfor \(const method of Reflect\.ownKeys\(def\)\) \{)",
    r"\1\t\tconst identityRuntimeSteps = isIdentityRuntimeStepPlugin(def)\n\2",
    'plugin trait lookup',
)
text = sub_once(
    text,
    r"(\t\t\tstepMethods\[method\] = \{\n\t\t\t\trun: stepMethod,\n\t\t\t\tdefaultOperationMode,)(\n\t\t\t\})",
    r"\1\n\t\t\t\tidentityRuntimeSteps,\2",
    'registered method assignment',
)
core.write_text(text)

for name in ('string', 'number', 'boolean', 'bigint'):
    path = Path(f'packages/internal/src/steps/{name}/{name}.ts')
    text = path.read_text()
    text = sub_once(
        text,
        r"(import \{ implStepPlugin \} from '../../core'\n)",
        r"\1import { markIdentityRuntimeStepPlugin } from '../../core/runtime-traits'\n",
        f'{name} trait import',
    )
    text = sub_once(
        text,
        rf"export const {name} = implStepPlugin<PluginDef>\(\{{",
        f"export const {name} = /* @__PURE__ */ markIdentityRuntimeStepPlugin(implStepPlugin<PluginDef>({{",
        f'{name} wrapper start',
    )
    position = text.rfind("}, 'sync')")
    if position < 0:
        raise RuntimeError(f'{name}: sync plugin ending not found')
    text = text[:position] + "}, 'sync'))" + text[position + len("}, 'sync')"):]
    path.write_text(text)
    print(f'patched {name} wrapper ending', flush=True)

map_path = Path('packages/internal/src/steps/map/map.ts')
text = map_path.read_text()
text = sub_once(
    text,
    r"import \{ getExecutionEffects \} from '../../core/execution-effects'\n",
    "import { hasIdentityOnlyRuntimeSteps } from '../../core/runtime-traits'\n",
    'map trait import',
)
text = sub_once(
    text,
    r"\t\tconst keyEffects = getExecutionEffects\(options\.key\)\n\t\tconst valueEffects = getExecutionEffects\(options\.value\)\n\t\tconst childrenAreDirectSafe = childrenAreSynchronous\n\t\t\t&& keyEffects\.identity === 'identity-preserving'\n\t\t\t&& keyEffects\.parentTraversal === 'direct-safe'\n\t\t\t&& valueEffects\.parentTraversal === 'direct-safe'\n\t\tconst valueIsIdentityPreserving = valueEffects\.identity === 'identity-preserving'\n",
    "\t\tconst childrenAreDirectSafe = childrenAreSynchronous\n\t\t\t&& hasIdentityOnlyRuntimeSteps(options.key)\n\t\t\t&& hasIdentityOnlyRuntimeSteps(options.value)\n",
    'map plan selection',
)
text = sub_once(
    text,
    r"\t\t\t\t\toutput\.set\(\n\t\t\t\t\t\tsourceKey,\n\t\t\t\t\t\tvalueIsIdentityPreserving \? sourceValue : valueResult\.value,\n\t\t\t\t\t\)\n",
    "\t\t\t\t\toutput.set(sourceKey, sourceValue)\n",
    'map identity output',
)
map_path.write_text(text)

set_path = Path('packages/internal/src/steps/set/set.ts')
text = set_path.read_text()
text = sub_once(
    text,
    r"import \{ getExecutionEffects \} from '../../core/execution-effects'\n",
    "import { hasIdentityOnlyRuntimeSteps } from '../../core/runtime-traits'\n",
    'set trait import',
)
text = sub_once(
    text,
    r"\t\tconst itemEffects = getExecutionEffects\(itemSchema\)\n\t\tconst itemIsDirectIdentity = childIsSynchronous\n\t\t\t&& itemEffects\.identity === 'identity-preserving'\n\t\t\t&& itemEffects\.parentTraversal === 'direct-safe'\n",
    "\t\tconst itemIsDirectIdentity = childIsSynchronous\n\t\t\t&& hasIdentityOnlyRuntimeSteps(itemSchema)\n",
    'set plan selection',
)
set_path.write_text(text)

test_path = Path('packages/internal/src/steps/map/traversal-plan.test.ts')
text = test_path.read_text()
text = text.replace("import { implStepPlugin } from '../../core'\n", '')
text = text.replace("import { preserveExecutionEffects, withExecutionEffects } from '../../core/execution-effects'\n", '')
text = re.sub(r"const double = [\s\S]*?\n\n(?=const v =)", '', text, count=1)
text = text.replace('const v = createValchecker({ steps: [map, number, object, string, double] }) as any', 'const v = createValchecker({ steps: [map, number, object, string] })')
text = re.sub(
    r"\n\tit\('directly traverses identity keys with a trusted direct-safe value transform',[\s\S]*?(?=\n\tit\('keeps snapshot semantics)",
    '',
    text,
    count=1,
)
test_path.write_text(text)
print('patched map traversal tests', flush=True)

run('git', 'diff', '--check')
run('git', 'diff', '--stat')
