import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cancel, confirm, intro, isCancel, log, outro } from '@clack/prompts'
import { $ } from 'zx'
import {
	assertLockstepVersions,
	assertReleaseChangelog,
	cutUnreleasedChangelog,
	releaseManifestPaths,
	releaseTagForVersion,
} from './release-contract'

const repository = 'DevilTea/valchecker'
const publishWorkflowUrl = `https://github.com/${repository}/actions/workflows/release.yml`
const root = fileURLToPath(new URL('..', import.meta.url))

$.cwd = root
$.verbose = false
const $$ = $({ nothrow: true })

async function git(...args: string[]) {
	return (await $`git ${args}`).stdout.trim()
}

async function succeeds(command: Promise<{ exitCode: number | null }>) {
	return (await command).exitCode === 0
}

function fail(message: string): never {
	throw new Error(message)
}

async function assertGitHubCliReady() {
	if (!(await succeeds($$`gh --version`)))
		fail('The GitHub CLI (`gh`) is required.')
	if (!(await succeeds($$`gh auth status`)))
		fail('The GitHub CLI is not authenticated. Run `gh auth login` first.')
}

async function assertCleanWorktree() {
	if ((await git('status', '--porcelain')) !== '')
		fail('The working tree has uncommitted changes. Commit or stash them first.')
}

async function fetchMainAndTags() {
	await git('fetch', 'origin', 'main', '--tags')
}

async function assertSyncedMain() {
	const branch = await git('rev-parse', '--abbrev-ref', 'HEAD')
	if (branch !== 'main')
		fail(`Releases start from \`main\`, but the current branch is \`${branch}\`.`)
	await fetchMainAndTags()
	if ((await git('rev-parse', 'HEAD')) !== (await git('rev-parse', 'origin/main')))
		fail('Local `main` differs from `origin/main`. Pull or push before releasing.')
}

async function readWorkspaceVersion() {
	const entries = await Promise.all(releaseManifestPaths.map(async (path) => {
		const manifest = JSON.parse(await readFile(path, 'utf8')) as { version?: unknown }
		return { path, version: manifest.version }
	}))
	return assertLockstepVersions(entries)
}

async function remoteBranchExists(branch: string) {
	return (await git('ls-remote', '--heads', 'origin', branch)) !== ''
}

async function remoteTagExists(tag: string) {
	return (await git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) !== ''
}

async function localTagExists(tag: string) {
	return (await git('tag', '--list', tag)) !== ''
}

async function askToProceed(message: string, autoConfirm: boolean, onCancel?: () => Promise<void>) {
	if (autoConfirm)
		return
	const answer = await confirm({ message })
	if (isCancel(answer) || answer === false) {
		await onCancel?.()
		cancel('Release cancelled.')
		process.exit(0)
	}
}

function utcDate() {
	return new Date()
		.toISOString()
		.slice(0, 10)
}

async function openReleasePullRequest(release: string, autoConfirm: boolean) {
	intro('Release Valchecker')
	await assertGitHubCliReady()
	await assertCleanWorktree()
	await assertSyncedMain()

	const previousVersion = await readWorkspaceVersion()
	await $`pnpm exec bumpp ${releaseManifestPaths} --release ${release} --no-commit --no-tag --no-push --yes`

	const restoreBump = async () => {
		await git('restore', '--', ...releaseManifestPaths, 'pnpm-lock.yaml', 'CHANGELOG.md')
	}

	let version: string
	let tag: string
	let branch: string
	try {
		version = await readWorkspaceVersion()
		if (version === previousVersion)
			fail(`Bumpp left the workspace at ${previousVersion}.`)
		tag = releaseTagForVersion(version)
		branch = `release/${tag}`
		if (await localTagExists(tag))
			fail(`Tag ${tag} already exists locally.`)
		if (await remoteTagExists(tag))
			fail(`Tag ${tag} already exists on origin; that version is already released.`)
		if (await remoteBranchExists(branch))
			fail(`Release branch already exists on origin: ${branch}`)

		const changelog = await readFile('CHANGELOG.md', 'utf8')
		const nextChangelog = cutUnreleasedChangelog(changelog, version, utcDate())
		await writeFile('CHANGELOG.md', nextChangelog)
		assertReleaseChangelog(nextChangelog, version)
	}
	catch (error) {
		await restoreBump()
		throw error
	}

	log.step(`Valchecker workspace: ${previousVersion} → ${version}`)
	log.info(`Branch \`${branch}\`, release tag \`${tag}\`.`)
	await askToProceed('Open the release pull request?', autoConfirm, restoreBump)

	await git('switch', '--create', branch)
	await git('add', '--', ...releaseManifestPaths, 'pnpm-lock.yaml', 'CHANGELOG.md')
	if (await succeeds($$`git diff --cached --quiet`))
		fail('Release preparation produced no staged changes.')
	await git('commit', '-m', `chore(release): ${tag}`)
	await git('push', '--set-upstream', 'origin', branch)

	const body = [
		`Release candidate for \`${tag}\`.`,
		'',
		'All publishable packages are version-locked and required CI validates the immutable tarballs.',
		'',
		`After merge, run \`pnpm release:tag\` from synchronized \`main\`. Pushing the annotated \`${tag}\` tag authorizes npm publication.`,
	].join('\n')
	const url = (await $`gh pr create --base main --head ${branch} --title ${`chore(release): ${tag}`} --body ${body}`).stdout.trim()
	await $`gh pr merge ${url} --auto --squash --delete-branch`
	await git('switch', 'main')
	outro(`Release pull request opened with auto-merge: ${url}`)
	log.info('After it merges, run `pnpm release:tag`.')
}

async function pushReleaseTag(autoConfirm: boolean) {
	intro('Tag Valchecker release')
	await assertCleanWorktree()
	await fetchMainAndTags()
	await git('switch', 'main')
	await git('merge', '--ff-only', 'origin/main')

	const version = await readWorkspaceVersion()
	const tag = releaseTagForVersion(version)
	const changelog = await readFile('CHANGELOG.md', 'utf8')
	assertReleaseChangelog(changelog, version)
	if (await localTagExists(tag))
		fail(`Tag ${tag} already exists locally.`)
	if (await remoteTagExists(tag))
		fail(`Tag ${tag} already exists on origin; that version is already released.`)

	const head = await git('rev-parse', '--short', 'HEAD')
	const subject = await git('log', '-1', '--pretty=%s')
	log.step(`${version} → annotated tag \`${tag}\``)
	log.info(`main is at ${head} (${subject}).`)
	log.warn('Pushing this tag authorizes publication of all three packages to npm.')
	await askToProceed(`Push \`${tag}\` and publish Valchecker ${version}?`, autoConfirm)

	await git('tag', '--annotate', tag, '--message', tag)
	await git('push', 'origin', tag)
	outro(`Pushed ${tag}. Publish run: ${publishWorkflowUrl}`)
}

const [command, ...rest] = process.argv.slice(2)
const autoConfirm = rest.includes('--yes') || rest.includes('-y')
const operands = rest.filter(value => !value.startsWith('-'))

function usage(): never {
	fail([
		'Usage:',
		'  pnpm release <release>   Bump the lockstep workspace, cut CHANGELOG.md, and open the release PR',
		'  pnpm release:tag         Fast-forward main, confirm, and push the annotated release tag',
	].join('\n'))
}

try {
	switch (command) {
		case 'open':
			if (operands.length !== 1)
				usage()
			await openReleasePullRequest(operands[0]!, autoConfirm)
			break
		case 'tag':
			if (operands.length !== 0)
				usage()
			await pushReleaseTag(autoConfirm)
			break
		default:
			usage()
	}
}
catch (error) {
	cancel(error instanceof Error ? error.message : String(error))
	process.exit(1)
}
