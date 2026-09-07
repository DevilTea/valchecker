import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import process from 'node:process'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const packageDefinitions = [
	{ name: '@valchecker/internal', directory: 'packages/internal' },
	{ name: '@valchecker/all-steps', directory: 'packages/all-steps' },
	{ name: 'valchecker', directory: 'packages/valchecker' },
]

function run(command, args, cwd) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd,
			env: { ...process.env, CI: 'true' },
			stdio: 'inherit',
		})
		child.once('error', reject)
		child.once('exit', (code, signal) => {
			if (code === 0)
				resolvePromise()
			else
				reject(new Error(`${command} ${args.join(' ')} exited with ${signal ?? code}`))
		})
	})
}

function fileSpecifier(from, target) {
	const path = relative(from, target)
		.split(sep)
		.join('/')
	return `file:${path.startsWith('.') ? path : `./${path}`}`
}

async function packPackage(workspaceRoot, definition, tarballDirectory) {
	const before = new Set(await readdir(tarballDirectory))
	await run(pnpm, [
		'--dir',
		resolve(workspaceRoot, definition.directory),
		'pack',
		'--pack-destination',
		tarballDirectory,
	], workspaceRoot)
	const created = (await readdir(tarballDirectory)).filter(file => !before.has(file))
	if (created.length !== 1 || !created[0]?.endsWith('.tgz'))
		throw new Error(`Expected one tarball for ${definition.name}, got ${created.join(', ')}`)
	return join(tarballDirectory, created[0])
}

/**
 * Install exactly the three tarballs produced from one workspace revision into an isolated
 * consumer. The override is load-bearing: workspace dependencies inside the packed public
 * package must resolve to this same artifact set, never to an existing registry copy.
 */
export async function createPackedValcheckerConsumer(workspaceRoot) {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'valchecker-bundle-consumer-'))
	try {
		const tarballDirectory = join(temporaryRoot, 'tarballs')
		const consumerDirectory = join(temporaryRoot, 'consumer')
		await mkdir(tarballDirectory, { recursive: true })
		await mkdir(consumerDirectory, { recursive: true })

		const tarballs = new Map()
		for (const definition of packageDefinitions)
			tarballs.set(definition.name, await packPackage(workspaceRoot, definition, tarballDirectory))

		const dependencies = Object.fromEntries(packageDefinitions.map(({ name }) => [
			name,
			fileSpecifier(consumerDirectory, tarballs.get(name)),
		]))
		await writeFile(join(consumerDirectory, 'package.json'), `${JSON.stringify({
			name: 'valchecker-bundle-consumer',
			private: true,
			type: 'module',
			packageManager: 'pnpm@10.34.4',
			dependencies,
			pnpm: { overrides: dependencies },
		}, null, '\t')}\n`)
		await writeFile(join(consumerDirectory, 'entry.mjs'), '')
		await run(pnpm, [
			'install',
			'--ignore-workspace',
			'--frozen-lockfile=false',
			'--prefer-offline',
			'--ignore-scripts',
		], consumerDirectory)

		const manifests = {}
		for (const definition of packageDefinitions) {
			const packageRoot = join(consumerDirectory, 'node_modules', ...definition.name.split('/'))
			const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
			if (manifest.name !== definition.name)
				throw new Error(`Packed consumer expected ${definition.name}, got ${String(manifest.name)}`)
			manifests[definition.name] = {
				version: manifest.version,
				sideEffects: manifest.sideEffects,
			}
		}

		const parentFile = join(consumerDirectory, 'entry.mjs')
		const resolveFromConsumer = createRequire(parentFile).resolve
		const publicEntry = resolveFromConsumer('valchecker')
		for (const sibling of ['@valchecker/internal', '@valchecker/all-steps']) {
			const directSibling = resolveFromConsumer(sibling)
			const resolvedSibling = createRequire(publicEntry)
				.resolve(sibling)
			if (realpathSync(resolvedSibling) !== realpathSync(directSibling)) {
				throw new Error(
					`Packed valchecker resolved ${sibling} to a different physical package than the supplied tarball: ${resolvedSibling}`,
				)
			}
		}

		return {
			root: temporaryRoot,
			consumerDirectory,
			parentFile,
			resolve: resolveFromConsumer,
			manifests,
			cleanup: () => rm(temporaryRoot, { recursive: true, force: true }),
		}
	}
	catch (error) {
		await rm(temporaryRoot, { recursive: true, force: true })
		throw error
	}
}
