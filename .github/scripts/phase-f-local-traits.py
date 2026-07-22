from pathlib import Path

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
old = """\t\tif (identityRuntimeSteps) {
\t\t\treturn function identityRuntimeStep(lastResult) {
\t\t\t\ttry {
\t\t\t\t\treturn fn(lastResult) as ExecutionResult
\t\t\t\t}
\t\t\t\tcatch (error) {
\t\t\t\t\treturn createUnknownExceptionFailure(method, lastResult, error, resolveMessage)
\t\t\t\t}
\t\t\t}
\t\t}
"""
new = """\t\tif (identityRuntimeSteps) {
\t\t\treturn (lastResult, _identityMarker?: never) => {
\t\t\t\ttry {
\t\t\t\t\treturn fn(lastResult) as ExecutionResult
\t\t\t\t}
\t\t\t\tcatch (error) {
\t\t\t\t\treturn createUnknownExceptionFailure(method, lastResult, error, resolveMessage)
\t\t\t\t}
\t\t\t}
\t\t}
"""
if text.count(old) != 1:
    raise RuntimeError(f'core identity wrapper: expected one block, found {text.count(old)}')
core.write_text(text.replace(old, new, 1))

traits = Path('packages/internal/src/core/runtime-traits.ts')
text = traits.read_text()
old = """\t// Core emits constructable wrappers only for explicitly marked built-in
\t// identity plugins; every untrusted or potentially transforming step is an arrow.
\tfor (let index = 0; index < runtimeSteps.length; index++) {
\t\tif (!Object.hasOwn(runtimeSteps[index]!, 'prototype'))
\t\t\treturn false
\t}
"""
new = """\t// Core preserves arrow-function call semantics for every runtime step. Trusted
\t// identity wrappers carry one unused optional parameter, so their immutable
\t// Function.length is 2; every normal wrapper has length 1.
\tfor (let index = 0; index < runtimeSteps.length; index++) {
\t\tif (runtimeSteps[index]!.length !== 2)
\t\t\treturn false
\t}
"""
if text.count(old) != 1:
    raise RuntimeError(f'runtime trait marker: expected one block, found {text.count(old)}')
traits.write_text(text.replace(old, new, 1))

Path('.github/workflows/agent-phase-g-arrow-marker.yml').unlink(missing_ok=True)
