import ts from 'typescript'

// The cell catalog read **statically**, from source text alone, so two git revisions can be
// compared without executing either build.
//
// Why this exists beside the executable catalog rather than instead of it. The measured
// catalog is collected by importing every `<name>.bench.ts` in a process whose package entry
// resolves to the dist under test, and that is right: it is the apparatus, and it comes from
// the checked-out ref so that editing a bench file cannot silently edit the measurement. The
// consequence is that the apparatus only ever knows the *candidate's* cells. A cell deleted or
// renamed in the candidate tree is never collected, never assigned to a shard, and can never
// appear in a baseline result — so the runtime presence difference reports `removed 0` for
// exactly the deletion it was supposed to surface. That is not a bug in the comparison; it is
// a question the runtime cannot answer, and it needs a different instrument.
//
// This module is that instrument. It parses the declaration instead of running it, which is
// what lets it read a revision it cannot build: `git show <ref>:<path>` produces text, and text
// is all this needs. Nothing here imports the library, the dist, `benchmarks/src/cells/`, or
// anything that registers a resolution hook — `scripts/bench-catalog-ids.test.ts` asserts that
// over this file's own import graph, because "it does not execute a build" is the property the
// whole approach rests on.
//
// What it cannot decide, and says so instead of guessing: a `name` or `group` that is not a
// string literal. A cell whose id is computed cannot be read from source, and reporting it as
// absent would invent a deletion. Those are returned as problems, and a caller that finds any
// must report them rather than present the diff as complete. Every cell in this repository
// today writes both as literals, which is also what `pnpm bench:cells` needs to name a cell in
// a failure message.

/** A cell as source declares it: its id, and the group that decides whether the gate measures it. */
export interface StaticCell {
	id: string
	group: string
}

export interface StaticCatalog {
	/** Gate cells only, sorted: `baseline` is excluded here exactly as it is at runtime. */
	ids: string[]
	/** Everything this reader could not decide. A non-empty list makes the diff incomplete. */
	problems: string[]
}

function stringLiteral(node: ts.Expression | undefined): string | null {
	return node != null && ts.isStringLiteralLike(node) ? node.text : null
}

function propertyOf(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
	for (const property of object.properties) {
		if (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name)
			&& property.name.getText(property.getSourceFile())
				.replace(/^['"]|['"]$/g, '') === name) {
			return property.initializer
		}
	}
	return undefined
}

/** Every `stepBench()` call in one file, as the cells it declares. */
export function cellsOfSource(path: string, text: string): { cells: StaticCell[], problems: string[] } {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true)
	const cells: StaticCell[] = []
	const problems: string[] = []
	let calls = 0

	const visit = (node: ts.Node): void => {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'stepBench') {
			calls++
			const step = stringLiteral(node.arguments[0])
			const list = node.arguments[1]
			if (step == null) {
				problems.push(`${path}: \`stepBench()\` is called with a step name that is not a string literal, so its cell ids cannot be read from source`)
			}
			else if (list == null || !ts.isArrayLiteralExpression(list)) {
				problems.push(`${path}: \`stepBench('${step}', …)\` is called with cells that are not an array literal, so its cell ids cannot be read from source`)
			}
			else {
				for (const [index, element] of list.elements.entries()) {
					if (!ts.isObjectLiteralExpression(element)) {
						problems.push(`${path}: cell ${index} of \`stepBench('${step}', …)\` is not an object literal, so its id cannot be read from source`)
						continue
					}
					const name = stringLiteral(propertyOf(element, 'name'))
					const group = stringLiteral(propertyOf(element, 'group'))
					if (name == null || group == null) {
						problems.push(`${path}: cell ${index} of \`stepBench('${step}', …)\` declares a ${name == null ? 'name' : 'group'} that is not a string literal, so it cannot be read from source`)
						continue
					}
					cells.push({ id: `${step}/${name}`, group })
				}
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(source)

	if (calls === 0)
		problems.push(`${path}: declares no \`stepBench()\` call, so this reader found no cells in it`)
	return { cells, problems }
}

/** The gate's static catalog for one revision, from that revision's bench files. */
export function staticCatalog(files: readonly { path: string, text: string }[]): StaticCatalog {
	const ids: string[] = []
	const problems: string[] = []
	for (const file of files) {
		const { cells, problems: fileProblems } = cellsOfSource(file.path, file.text)
		problems.push(...fileProblems)
		// `baseline` is excluded for the same reason the runtime catalog excludes it: a cell that
		// measures JavaScript rather than the library is not part of the gate's set, so its
		// arrival or departure is not a change to what the gate covers.
		for (const cell of cells) {
			if (cell.group !== 'baseline')
				ids.push(cell.id)
		}
	}
	const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
	for (const id of [...new Set(duplicates)])
		problems.push(`the cell id '${id}' is declared twice across the revision's bench files, so a diff cannot tell which one moved`)
	return { ids: [...new Set(ids)].sort(), problems: [...new Set(problems)] }
}

export interface CatalogIdDiff {
	/** Cell ids the head declares and the base did not. */
	added: string[]
	/** Cell ids the base declared and the head does not — the deletion the runtime cannot see. */
	removed: string[]
	baseCells: number
	headCells: number
	/** Anything either side could not read. A non-empty list means the counts are not a complete audit. */
	problems: string[]
}

export function catalogIdDiff(base: StaticCatalog, head: StaticCatalog): CatalogIdDiff {
	const baseIds = new Set(base.ids)
	const headIds = new Set(head.ids)
	return {
		added: head.ids.filter(id => !baseIds.has(id)),
		removed: base.ids.filter(id => !headIds.has(id)),
		baseCells: base.ids.length,
		headCells: head.ids.length,
		problems: [...new Set([...base.problems.map(problem => `base: ${problem}`), ...head.problems.map(problem => `head: ${problem}`)])],
	}
}
