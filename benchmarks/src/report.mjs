import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))

function parseArguments(argv) {
  const options = {
    input: resolve(benchmarkRoot, 'results/raw.json'),
    markdown: resolve(benchmarkRoot, 'results/report.md'),
    html: resolve(benchmarkRoot, 'results/report.html'),
  }

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    const value = argv[index + 1]
    if (argument === '--input' && value) {
      options.input = resolve(benchmarkRoot, value)
      index++
    }
    else if (argument === '--markdown' && value) {
      options.markdown = resolve(benchmarkRoot, value)
      index++
    }
    else if (argument === '--html' && value) {
      options.html = resolve(benchmarkRoot, value)
      index++
    }
    else {
      throw new Error(`Unknown or incomplete argument: ${argument}`)
    }
  }

  return options
}

function assertFinitePositive(value, path) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${path} must be a finite positive number`)
}

function validateResult(raw) {
  if (!raw || typeof raw !== 'object')
    throw new TypeError('Benchmark result must be an object')
  if (raw.schemaVersion !== 1)
    throw new Error(`Unsupported benchmark schema version: ${raw.schemaVersion}`)
  if (!Array.isArray(raw.libraries) || raw.libraries.length === 0)
    throw new Error('Benchmark result must contain at least one library')

  const expectedScenarios = new Map()
  const adapterNames = new Set()

  for (const [libraryIndex, library] of raw.libraries.entries()) {
    if (!library || typeof library !== 'object')
      throw new TypeError(`libraries[${libraryIndex}] must be an object`)
    if (typeof library.adapter !== 'string' || library.adapter.length === 0)
      throw new Error(`libraries[${libraryIndex}].adapter must be a non-empty string`)
    if (adapterNames.has(library.adapter))
      throw new Error(`Duplicate adapter result: ${library.adapter}`)
    adapterNames.add(library.adapter)

    if (!Array.isArray(library.results) || library.results.length === 0)
      throw new Error(`${library.adapter} must contain benchmark results`)

    const scenarios = new Set()
    for (const [resultIndex, result] of library.results.entries()) {
      const path = `${library.adapter}.results[${resultIndex}]`
      if (!result || typeof result !== 'object')
        throw new TypeError(`${path} must be an object`)
      if (typeof result.scenario !== 'string' || result.scenario.length === 0)
        throw new Error(`${path}.scenario must be a non-empty string`)
      if (scenarios.has(result.scenario))
        throw new Error(`${library.adapter} contains duplicate scenario ${result.scenario}`)
      scenarios.add(result.scenario)

      if (!['construction', 'cold', 'warm'].includes(result.category))
        throw new Error(`${path}.category is invalid`)
      assertFinitePositive(result.medianOpsPerSecond, `${path}.medianOpsPerSecond`)
      assertFinitePositive(result.medianNanosecondsPerOperation, `${path}.medianNanosecondsPerOperation`)
      if (!Number.isFinite(result.relativeMarginOfError) || result.relativeMarginOfError < 0)
        throw new Error(`${path}.relativeMarginOfError must be a finite non-negative number`)
      if (!Array.isArray(result.samples) || result.samples.length === 0)
        throw new Error(`${path}.samples must be a non-empty array`)

      const expectedCategory = expectedScenarios.get(result.scenario)
      if (expectedCategory !== undefined && expectedCategory !== result.category)
        throw new Error(`Scenario category mismatch for ${result.scenario}`)
      expectedScenarios.set(result.scenario, result.category)
    }

    if (libraryIndex > 0) {
      const missing = [...expectedScenarios.keys()].filter(scenario => !scenarios.has(scenario))
      const extra = [...scenarios].filter(scenario => !expectedScenarios.has(scenario))
      if (missing.length > 0 || extra.length > 0)
        throw new Error(`${library.adapter} scenario set mismatch; missing=${missing.join(',')}; extra=${extra.join(',')}`)
    }
  }

  return raw
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
}

function formatRatio(value) {
  return `${value.toFixed(2)}×`
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function scenarioRows(raw, scenario) {
  const rows = raw.libraries.map((library) => {
    const result = library.results.find(item => item.scenario === scenario)
    if (!result)
      throw new Error(`${library.adapter} is missing scenario ${scenario}`)
    return {
      adapter: library.adapter,
      library: library.name,
      version: library.version,
      ...result,
    }
  }).sort((left, right) => right.medianOpsPerSecond - left.medianOpsPerSecond)

  const fastest = rows[0].medianOpsPerSecond
  const valchecker = rows.find(row => row.adapter === 'valchecker')?.medianOpsPerSecond

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    percentOfFastest: row.medianOpsPerSecond / fastest * 100,
    versusValchecker: valchecker ? row.medianOpsPerSecond / valchecker : null,
    unstable: row.relativeMarginOfError > 5,
  }))
}

function metadataRows(raw) {
  return [
    ['Profile', raw.mode],
    ['Seed', raw.seed],
    ['Started', raw.startedAt],
    ['Completed', raw.completedAt],
    ['Node.js', raw.environment.node],
    ['Platform', `${raw.environment.platform}/${raw.environment.arch}`],
    ['CPU', raw.environment.cpu],
    ['Logical CPUs', raw.environment.logicalCpuCount],
    ['Commit', raw.environment.commit ?? 'local'],
    ['Execution order', raw.order.join(' → ')],
  ]
}

function renderMarkdown(raw) {
  const lines = [
    '# Valchecker cross-library benchmark report',
    '',
    '> Construction, cold execution, and warmed validation measure different costs and must not be combined into one overall ranking.',
    '',
    '## Run metadata',
    '',
    '| Field | Value |',
    '| --- | --- |',
    ...metadataRows(raw).map(([field, value]) => `| ${markdownCell(field)} | ${markdownCell(value)} |`),
    '',
    '## Results',
    '',
  ]

  const scenarios = raw.libraries[0].results.map(result => result.scenario)
  for (const scenario of scenarios) {
    const rows = scenarioRows(raw, scenario)
    lines.push(
      `### ${scenario}`,
      '',
      `Category: **${rows[0].category}**`,
      '',
      '| Rank | Library | Version | Median ops/s | Median ns/op | Fastest | vs Valchecker | RME |',
      '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
      ...rows.map(row => [
        row.rank,
        markdownCell(row.library),
        markdownCell(row.version),
        formatNumber(row.medianOpsPerSecond),
        formatNumber(row.medianNanosecondsPerOperation, 1),
        `${row.percentOfFastest.toFixed(1)}%`,
        row.versusValchecker === null ? 'n/a' : formatRatio(row.versusValchecker),
        `${row.relativeMarginOfError.toFixed(2)}%${row.unstable ? ' ⚠' : ''}`,
      ].join(' | ').replace(/^/, '| ').concat(' |')),
      '',
    )
  }

  lines.push(
    '## Interpretation rules',
    '',
    '- Compare libraries only within the same scenario and category.',
    '- Treat results with RME above 5% as unstable and rerun before drawing conclusions.',
    '- Failure-path measurements include each library’s issue construction and traversal behavior.',
    '- The raw JSON artifact remains the source of truth for every sample.',
    '',
  )

  return `${lines.join('\n')}\n`
}

function renderHtml(raw) {
  const scenarios = raw.libraries[0].results.map(result => result.scenario)
  const metadata = metadataRows(raw)
    .map(([field, value]) => `<tr><th>${htmlEscape(field)}</th><td>${htmlEscape(value)}</td></tr>`)
    .join('')
  const sections = scenarios.map((scenario) => {
    const rows = scenarioRows(raw, scenario)
      .map(row => `<tr${row.unstable ? ' class="unstable"' : ''}><td>${row.rank}</td><td>${htmlEscape(row.library)}</td><td>${htmlEscape(row.version)}</td><td>${formatNumber(row.medianOpsPerSecond)}</td><td>${formatNumber(row.medianNanosecondsPerOperation, 1)}</td><td>${row.percentOfFastest.toFixed(1)}%</td><td>${row.versusValchecker === null ? 'n/a' : formatRatio(row.versusValchecker)}</td><td>${row.relativeMarginOfError.toFixed(2)}%${row.unstable ? ' ⚠' : ''}</td></tr>`)
      .join('')
    const category = raw.libraries[0].results.find(result => result.scenario === scenario)?.category
    return `<section><h2>${htmlEscape(scenario)}</h2><p>Category: <strong>${htmlEscape(category)}</strong></p><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Library</th><th>Version</th><th>Median ops/s</th><th>Median ns/op</th><th>Fastest</th><th>vs Valchecker</th><th>RME</th></tr></thead><tbody>${rows}</tbody></table></div></section>`
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Valchecker benchmark report</title>
<style>
:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1180px;margin:0 auto;padding:32px 20px 64px}h1{margin-bottom:8px}h2{margin-top:40px}p,li{line-height:1.5}.notice{padding:12px 16px;border-left:4px solid #64748b;background:#e2e8f0}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:white}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:left}thead th{background:#e2e8f0}.metadata{max-width:760px}.metadata th{width:180px}.unstable{background:#fff7ed}code{font-family:ui-monospace,monospace}</style>
</head>
<body>
<h1>Valchecker cross-library benchmark report</h1>
<p class="notice">Construction, cold execution, and warmed validation measure different costs and must not be combined into one overall ranking.</p>
<h2>Run metadata</h2>
<table class="metadata"><tbody>${metadata}</tbody></table>
${sections}
<h2>Interpretation rules</h2>
<ul><li>Compare libraries only within the same scenario and category.</li><li>Treat results with RME above 5% as unstable and rerun before drawing conclusions.</li><li>Failure-path measurements include each library’s issue construction and traversal behavior.</li><li>The raw JSON artifact remains the source of truth for every sample.</li></ul>
</body>
</html>
`
}

const options = parseArguments(process.argv.slice(2))
const raw = validateResult(JSON.parse(await readFile(options.input, 'utf8')))
const markdown = renderMarkdown(raw)
const html = renderHtml(raw)

await Promise.all([
  mkdir(dirname(options.markdown), { recursive: true }),
  mkdir(dirname(options.html), { recursive: true }),
])
await Promise.all([
  writeFile(options.markdown, markdown),
  writeFile(options.html, html),
])

console.error(`[benchmark] wrote ${options.markdown}`)
console.error(`[benchmark] wrote ${options.html}`)
