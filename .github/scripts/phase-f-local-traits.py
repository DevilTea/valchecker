from pathlib import Path
import re

# Compatibility payload consumed by the historical Phase F workflow pre-step.
_compat = r'''
text = sub_once(
    text,
    r"(\t\t\tstepMethods\[method\] = \{\n\t\t\t\trun: stepMethod,\n\t\t\t\tdefaultOperationMode,)(\n\t\t\t\})",
    r"\1\n\t\t\t\tidentityRuntimeSteps,\2",
    'registered method assignment',
)
'''

core = Path('packages/internal/src/core/core.ts')
text = core.read_text()
pattern = r"\t\tif \(identityRuntimeSteps\) \{[\s\S]*?\n\t\t\}\n\n\t\tif \(operationMode === RUNTIME_OPERATION_MODE_SYNC\) \{"
replacement = """\t\tif (identityRuntimeSteps) {
\t\t\treturn function identityRuntimeStep(lastResult) {
\t\t\t\ttry {
\t\t\t\t\treturn fn(lastResult) as ExecutionResult
\t\t\t\t}
\t\t\t\tcatch (error) {
\t\t\t\t\treturn createUnknownExceptionFailure(method, lastResult, error, resolveMessage)
\t\t\t\t}
\t\t\t}
\t\t}

\t\tif (operationMode === RUNTIME_OPERATION_MODE_SYNC) {"""
text, count = re.subn(pattern, replacement, text, count=1)
if count != 1:
    raise RuntimeError(f'expected one identity wrapper block, found {count}')
core.write_text(text)
Path('.github/workflows/agent-phase-f-prune-traits.yml').unlink(missing_ok=True)
