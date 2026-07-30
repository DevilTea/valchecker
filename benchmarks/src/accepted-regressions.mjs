/**
 * Regressions the repository has decided to accept, and the rules that keep the list from
 * becoming a place regressions go to be forgotten.
 *
 * This is not a suppression and it is not `--fail-on-regression` off. An entry is a claim
 * with four parts a reader can check: which cell, how far down is accepted, why the cost was
 * bought, and — because it is the only part a script can decide — whether the claim is still
 * true. It follows the shape `scripts/check-benchmark-coverage.ts` established for the steps
 * no competitor can express, and is checked for rot in both directions for the same reason:
 * an entry for a cell that no longer regresses fails, so the list shrinks as the code
 * improves instead of quietly absorbing the next regression, and an entry for a cell that no
 * longer exists fails rather than lingering as a comment.
 *
 * **What it cannot decide, stated plainly.** It cannot tell an accepted cost from a
 * regression someone got tired of. The prose is the whole argument, `because` is not checked
 * against anything, and no rule here can notice that a reason stopped being true while the
 * numbers stayed the same. What the rules do is narrow: they refuse a claim that names
 * nothing, a claim the measurements contradict, and a regression deeper than the claim
 * covers. Review has to read the reason.
 *
 * Three further limits, so nobody has to discover them:
 *
 * - **A cell entry never reaches a group verdict.** "Did this cell regress?" and "did this
 *   affected group broadly regress?" are different questions, and an accepted answer to the
 *   first is not an answer to the second. A group is forgiven only by an entry that names the
 *   group, below, and the two lists are checked against each other.
 * - **Staleness is decided from the screen, never from the confirmation batch.** The
 *   confirmation batch measures a set chosen by the screen's outcome, and one batch clearing
 *   a cell the screen called severe is this gate's noise diagnostic rather than evidence the
 *   cost is gone — `json/invalid-json` did exactly that at −21.9% against +0.4%. A screen
 *   `cleared` is a statement about the whole run: the interval over every repetition sits
 *   inside ±5%, so the accepted cost is no longer measurable.
 * - **A cell nobody measured is not evidence either way.** A scoped run that never selected
 *   an acknowledged cell leaves its entry untouched rather than stale.
 */

/**
 * @typedef {object} AcceptedRegression
 * @property {string} cell The cell id, as the catalog declares it.
 * @property {number} maxRegressionPercent How far down is accepted, as a positive percentage.
 * A measurement past it fails, so the acknowledgement bounds the cost rather than the cell.
 * @property {string} because Why the cost was bought, for a person.
 */

/** @type {AcceptedRegression[]} */
export const acceptedRegressions = [
	{
		cell: 'map/collect-all',
		maxRegressionPercent: 25,
		because: 'The `firstIndex` correction in `map()` under `collectAllIssues`. A buffered entry used to be '
			+ 'recorded under its buffer position, which equals its source index only until something is skipped, so the '
			+ 'reported index was wrong exactly when collection had passed a failed entry; the buffer is now materialized '
			+ 'while the two still agree. The cost lands only on the failure-collection path — `collectAllIssues: true` '
			+ 'with an entry that has already failed — and the success path is untouched, which is why `map`\'s other '
			+ 'cells do not move. Two independent CI comparisons measured this cell at −14.67% and −7.67%, so the '
			+ 'direction is solid and the magnitude is not; the bound is set well past the worse of the two rather than '
			+ 'at it, because a bound tighter than the gate\'s own run-to-run spread would fail on noise instead of on a '
			+ 'change. A correct index for a diagnostic that exists to point at the entry that failed is worth this on a '
			+ 'path that is already the slow one.',
	},
	{
		cell: 'set/collect-all',
		maxRegressionPercent: 45,
		because: 'The same `firstIndex` correction in `set()`, whose buffered collection has the same shape as '
			+ '`map()`\'s and which pays more for it: two independent comparisons measured −15.13% and −32.37%, and the '
			+ 'confirmation batches of those runs measured −30.20% and −29.83%. That spread is the reason this entry '
			+ 'exists with a bound rather than as a note — the cost is real and consistently deeper than `map`\'s, and no '
			+ 'single figure describes it. The bound sits above the deepest measurement so a genuine further slowdown, '
			+ 'the kind a rewrite of the buffered path could introduce, still fails. Accepted on the same ground as '
			+ '`map`: the wrong index is a wrong answer, and this is the failure-collection path only.',
	},
]

/**
 * Groups whose aggregate is accepted, which is a different claim from accepting their cells.
 *
 * Why this exists rather than the alternative. `warm/failure/all` measured −6.40% with an
 * interval of [−7.1%, −5.7%], and that number is **true**: the group really is about 6.4%
 * slower, because two of its nine cells carry a cost the repository accepted. It is not a
 * false positive to suppress. The alternative — leaving acknowledged cells out of the
 * aggregate — was rejected outright, and the reason is worth keeping: it would condition the
 * aggregate on which cells someone previously forgave, which is the same disease
 * `groupEstimate` was rebuilt to remove, and it would shrink the denominator so a *new*
 * regression landing in the group would be diluted rather than caught. The reported group
 * number therefore stays the true one over every cell, and what a bound does is say how much
 * of it a person has agreed to.
 *
 * **What a group acknowledgement cannot decide:** whether the group's cost is still the
 * accepted one. It checks a magnitude against a number a person set. A future breach could be
 * the same cells drifting or something new arriving in the group, which is why the reason
 * below records how much each acknowledged cell contributes — so a reader can subtract.
 */
/** @type {{ group: string, maxRegressionPercent: number, because: string }[]} */
export const acceptedGroupRegressions = [
	{
		group: 'warm/failure/all',
		maxRegressionPercent: 12,
		because: 'The group-level measurement of the same accepted `firstIndex` correction. `warm/failure/all` holds one '
			+ 'collect-all cell per structure — nine of them — so the two cells this repository accepts carry the aggregate: '
			+ 'measured at −6.40% with an interval of [−7.1%, −5.7%], `set/collect-all` alone accounts for −4.25pp of it and '
			+ '`map/collect-all` for −0.88pp, the two together for −5.10pp, and the remaining seven cells for −1.37pp spread '
			+ 'across rows none of which is individually decisive. A reader checking a future breach should subtract those '
			+ 'contributions first: if the acknowledged cells still account for about −5pp and the group has moved well past '
			+ 'this bound, something else arrived in the group. The bound is 12% rather than 7% because this group sits '
			+ 'astride the −5% trigger and seven of its nine rows are individually inconclusive, so it flips between runs — '
			+ 'the previous comparison put the same group at −3.93% and called it inconclusive — while 12% still fails if the '
			+ 'group effect roughly doubles. This entry is void the moment its member cells stop being acknowledged, which '
			+ 'is checked rather than trusted.',
	},
]

const minimumReasonLength = 200

/** Rows whose measurement claims a regression, which is what an acknowledgement can cover. */
function claimsRegression(row) {
	return row.screen === 'severe' || row.screen === 'regression'
		|| row.confirm === 'severe' || row.confirm === 'regression'
}

/** The deepest regression either stage measured on a row, as a positive percentage. */
export function deepestRegressionPercent(row) {
	const deltas = [row.screenDelta, row.confirmDelta].filter(delta => typeof delta === 'number')
	return deltas.length === 0 ? 0 : Math.max(0, -Math.min(...deltas) * 100)
}

/**
 * Refuses an entry that cannot be read as one. Checked wherever the list is read, so a
 * malformed entry cannot pass by being consulted from somewhere that does not validate.
 */
export function malformedAcceptedRegressions(entries = acceptedRegressions) {
	const problems = []
	const seen = new Set()
	for (const entry of entries) {
		if (typeof entry.cell !== 'string' || entry.cell.length === 0) {
			problems.push('an accepted-regression entry names no cell')
			continue
		}
		if (seen.has(entry.cell))
			problems.push(`the accepted-regression list names '${entry.cell}' twice, so one of the two bounds is being ignored`)
		seen.add(entry.cell)
		if (!Number.isFinite(entry.maxRegressionPercent) || entry.maxRegressionPercent <= 0)
			problems.push(`the accepted-regression entry for '${entry.cell}' records no positive \`maxRegressionPercent\`, so it would accept a regression of any depth`)
		if (typeof entry.because !== 'string' || entry.because.trim().length < minimumReasonLength)
			problems.push(`the accepted-regression entry for '${entry.cell}' needs a reason of at least ${minimumReasonLength} characters saying what the cost bought and where it lands`)
	}
	return problems
}

/**
 * Entries naming a cell the catalog does not declare.
 *
 * Separated because it needs no measurement: the catalog alone decides it, so `pnpm
 * bench:cells` fails on a renamed or deleted cell immediately instead of a comparison
 * discovering it half an hour later.
 */
export function unknownAcceptedRegressions(catalogCells, entries = acceptedRegressions) {
	const known = new Set(catalogCells.map(cell => cell.id))
	return entries.filter(entry => !known.has(entry.cell))
		.map(entry => entry.cell)
}

/**
 * How the acknowledgement list stands against one comparison's rows.
 *
 * - `acknowledged` — the entry covers what was measured. The row does not block, and the
 *   report names it with its bound.
 * - `exceeded` — the row regressed deeper than the entry accepts. It blocks, and the message
 *   carries both numbers, because "we accepted 25% and measured 60%" is a different
 *   conversation from "this regressed".
 * - `stale` — the screen decisively says this cell no longer regresses. The entry must go,
 *   and until it does the gate fails: a list that outlives its reasons is the failure mode
 *   this mechanism is most likely to rot into.
 */
/**
 * `rows` must cover **every measured cell**, not only the ones the confirmation stage
 * selected: a cell the screen cleared is never selected, so evaluating the selection alone
 * could never find a stale entry — which is the direction that matters most.
 */
/** The same well-formedness rules, over the group list. */
export function malformedAcceptedGroupRegressions(entries = acceptedGroupRegressions) {
	const problems = []
	const seen = new Set()
	for (const entry of entries) {
		if (typeof entry.group !== 'string' || entry.group.length === 0) {
			problems.push('an accepted-group-regression entry names no group')
			continue
		}
		if (seen.has(entry.group))
			problems.push(`the accepted-group-regression list names '${entry.group}' twice, so one of the two bounds is being ignored`)
		seen.add(entry.group)
		if (!Number.isFinite(entry.maxRegressionPercent) || entry.maxRegressionPercent <= 0)
			problems.push(`the accepted-group-regression entry for '${entry.group}' records no positive \`maxRegressionPercent\`, so it would accept a regression of any depth`)
		if (typeof entry.because !== 'string' || entry.because.trim().length < minimumReasonLength)
			problems.push(`the accepted-group-regression entry for '${entry.group}' needs a reason of at least ${minimumReasonLength} characters saying which cells carry the aggregate and what the cost bought`)
	}
	return problems
}

/** Group entries naming a group no cell in the catalog aggregates into. */
export function unknownAcceptedGroupRegressions(catalogCells, entries = acceptedGroupRegressions) {
	const known = new Set(catalogCells.map(cell => cell.group))
	return entries.filter(entry => !known.has(entry.group))
		.map(entry => entry.group)
}

/**
 * Group entries none of whose member cells is acknowledged.
 *
 * The rot check a cell entry does not need. A group is forgiven because the cells carrying its
 * aggregate are forgiven; once those entries go — because the buffered path was optimized, or
 * because someone decided the cost was no longer acceptable — the group entry has no reason
 * left and must not outlive them as a standing exemption for whatever lands in that group
 * next. Decided from the catalog and the two lists, so it needs no measurement.
 */
export function groupsWithoutAcknowledgedCells(
	catalogCells,
	groupEntries = acceptedGroupRegressions,
	cellEntries = acceptedRegressions,
) {
	const acknowledgedCells = new Set(cellEntries.map(entry => entry.cell))
	return groupEntries
		.filter(entry => !catalogCells.some(cell => cell.group === entry.group && acknowledgedCells.has(cell.id)))
		.map(entry => entry.group)
}

/**
 * How the group list stands against one comparison's group rows.
 *
 * The same three outcomes as the cell list, read from the group's own estimate: `acknowledged`
 * when the measured aggregate is within the bound, `exceeded` when it is deeper, `stale` when
 * the screen decisively reports the group is not down at all. A group the run could not judge
 * leaves its entry untouched.
 */
export function evaluateAcceptedGroupRegressions(groups, entries = acceptedGroupRegressions) {
	const byGroup = new Map(entries.map(entry => [entry.group, entry]))
	const acknowledged = []
	const exceeded = []
	const stale = []
	for (const group of groups) {
		const entry = byGroup.get(group.group)
		if (entry == null || group.delta == null)
			continue
		if (group.classification === 'cleared' || group.classification === 'improvement') {
			stale.push({ group: entry.group, screen: group.classification, screenDelta: group.delta })
			continue
		}
		if (group.classification !== 'regression')
			continue
		const depth = Math.max(0, -group.delta * 100)
		const record = { group: entry.group, bound: entry.maxRegressionPercent, depthPercent: depth, because: entry.because }
		if (depth > entry.maxRegressionPercent)
			exceeded.push(record)
		else
			acknowledged.push(record)
	}
	return { acknowledged, exceeded, stale }
}

export function evaluateAcceptedRegressions(rows, entries = acceptedRegressions) {
	const byCell = new Map(entries.map(entry => [entry.cell, entry]))
	const acknowledged = []
	const exceeded = []
	const stale = []
	for (const row of rows) {
		const entry = byCell.get(row.scenario)
		if (entry == null)
			continue
		if (row.screen === 'cleared' || row.screen === 'improvement') {
			stale.push({ cell: entry.cell, screen: row.screen, screenDelta: row.screenDelta })
			continue
		}
		if (!claimsRegression(row))
			continue
		const depth = deepestRegressionPercent(row)
		const record = { cell: entry.cell, bound: entry.maxRegressionPercent, depthPercent: depth, because: entry.because }
		if (depth > entry.maxRegressionPercent)
			exceeded.push(record)
		else
			acknowledged.push(record)
	}
	return { acknowledged, exceeded, stale }
}
