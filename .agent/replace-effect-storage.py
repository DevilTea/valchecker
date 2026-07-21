from pathlib import Path

path = Path('packages/internal/src/core/core.ts')
content = path.read_text()

replacements = [
    (
        "import { conservativeExecutionEffects, neutralExecutionEffects, registerExecutionEffects } from './execution-effects'",
        "import { conservativeExecutionEffects, executionEffectsKey, neutralExecutionEffects } from './execution-effects'",
    ),
    (
        """function createCoreProperties(
\truntimeSteps: RuntimeStep[],
\texecuteRaw: PipeExecutor,
\toperationMode: RuntimeOperationMode,
) {
""",
        """function createCoreProperties(
\truntimeSteps: RuntimeStep[],
\texecuteRaw: PipeExecutor,
\toperationMode: RuntimeOperationMode,
\texecutionEffects: ExecutionEffects,
) {
""",
    ),
    (
        """\treturn {
\t\t'~standard': {
""",
        """\treturn {
\t\t[executionEffectsKey]: executionEffects,
\t\t'~standard': {
""",
    ),
    (
        """\tconst executeRaw = createFinalizedPipeExecutor(currentRuntimeSteps, currentOperationMode)
\tconst coreProperties = createCoreProperties(currentRuntimeSteps, executeRaw, currentOperationMode)

\tconst instance = new Proxy(coreProperties, createProxyHandler({
""",
        """\tconst executeRaw = createFinalizedPipeExecutor(currentRuntimeSteps, currentOperationMode)
\tconst coreProperties = createCoreProperties(
\t\tcurrentRuntimeSteps,
\t\texecuteRaw,
\t\tcurrentOperationMode,
\t\tcurrentExecutionEffects,
\t)

\treturn new Proxy(coreProperties, createProxyHandler({
""",
    ),
    (
        """\t\tcontext,
\t}))
\tregisterExecutionEffects(instance, currentExecutionEffects)
\treturn instance
}
""",
        """\t\tcontext,
\t}))
}
""",
    ),
]

for old, new in replacements:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one replacement, found {count}: {old[:80]!r}')
    content = content.replace(old, new, 1)

path.write_text(content)
