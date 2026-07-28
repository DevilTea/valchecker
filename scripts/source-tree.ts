import fs from 'node:fs'
import path from 'node:path'

// The repository as the gates read it: repository-relative POSIX paths in, text out.
//
// It exists so that the logic of a gate can be a pure function of a tree and its tests can
// drive it over a small synthetic repository whose expected answers are written out by hand,
// instead of over the real 114-step tree where every expectation would have to be computed
// with the function under test. `scripts/impact-selection.ts` was the first to need that;
// `scripts/step-inventory.ts` and `scripts/step-completeness.ts` are the second and third,
// which is why the interface and its one real implementation moved here.

/** A repository tree, addressed by repository-relative POSIX paths. */
export interface SourceTree {
	/** The file's text, or `null` when it does not exist or is not a file. */
	read: (path: string) => string | null
	/** Names of the direct entries of a directory, or `null` when it is not one. */
	list: (directory: string) => string[] | null
	/** Whether the path is a directory. */
	isDirectory: (path: string) => boolean
}

/**
 * A tree held in memory, from a map of repository-relative path to text.
 *
 * Every directory on the way to a listed file exists; nothing else does. This is what the gate
 * tests are written against: a repository small enough that each expected answer can be written
 * out by hand rather than computed with the function under test.
 */
export function objectTree(files: Record<string, string>): SourceTree {
	const paths = Object.keys(files)
	const directories = new Set<string>()
	for (const path of paths) {
		const parts = path.split('/')
		for (let index = 1; index < parts.length; index++) {
			directories.add(parts.slice(0, index)
				.join('/'))
		}
	}
	return {
		read: path => files[path] ?? null,
		list: (directory) => {
			if (!directories.has(directory))
				return null
			const prefix = `${directory}/`
			const names = new Set<string>()
			for (const path of paths) {
				if (path.startsWith(prefix)) {
					names.add(path.slice(prefix.length)
						.split('/')[0]!)
				}
			}
			return [...names]
		},
		isDirectory: path => directories.has(path),
	}
}

/**
 * The real tree under `rootDirectory`.
 *
 * `path.join` accepts POSIX separators on Windows, so callers keep writing
 * `packages/internal/src/steps` whatever the platform resolves it to.
 */
export function fileSystemTree(rootDirectory: string): SourceTree {
	const resolve = (relative: string): string => path.join(rootDirectory, relative)
	return {
		read: (relative) => {
			try {
				return fs.readFileSync(resolve(relative), 'utf8')
			}
			catch {
				return null
			}
		},
		list: (relative) => {
			try {
				return fs.readdirSync(resolve(relative))
			}
			catch {
				return null
			}
		},
		isDirectory: (relative) => {
			try {
				return fs.statSync(resolve(relative))
					.isDirectory()
			}
			catch {
				return false
			}
		},
	}
}
