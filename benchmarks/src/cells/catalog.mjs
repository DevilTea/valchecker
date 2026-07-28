/**
 * Prints the cell catalog as JSON: every gate cell's id, the group it aggregates into,
 * and the single step a diff reaches it through.
 *
 * A separate entry point rather than a function other tools import, because collecting
 * cells needs this directory's resolution hooks and those only apply to Node's own ESM
 * resolution. Inside a vitest worker — which runs modules through its own loader —
 * `vitest` would resolve to the real test runner and a bench file would try to register
 * a suite from inside a test. So a caller running under another loader spawns this
 * instead of importing `collect.mjs`, and gets the same catalog the runner measures.
 */

import process from 'node:process'
import { cellCatalog, collectStepBenches } from './collect.mjs'

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
process.stdout.write(JSON.stringify(cellCatalog(await collectStepBenches())))
