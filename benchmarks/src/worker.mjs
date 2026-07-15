import { measure } from './measure.mjs'
import { getScenarios } from './scenarios.mjs'

const adapterName = process.argv[2]
const mode = process.argv[3] ?? 'standard'

const adapterPaths = {
  valchecker: './adapters/valchecker.mjs',
  zod3: './adapters/zod3.mjs',
  zod4: './adapters/zod4.mjs',
  'zod4-jitless': './adapters/zod4-jitless.mjs',
  valibot: './adapters/valibot.mjs',
}

const adapterPath = adapterPaths[adapterName]
if (!adapterPath)
  throw new Error(`Unknown benchmark adapter: ${adapterName}`)

const adapter = (await import(adapterPath)).default
const results = []

for (const scenario of getScenarios(mode)) {
  const operation = scenario.setup(adapter)
  results.push({
    scenario: scenario.id,
    category: scenario.category,
    ...measure(operation, mode),
  })
}

process.stdout.write(JSON.stringify({
  adapter: adapterName,
  name: adapter.name,
  version: adapter.version,
  results,
}))
