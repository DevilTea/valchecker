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
 * - **Un-acknowledging needs the same evidence as blocking.** An entry is stale only when
 *   both* measurements of it agree that the cost is gone: the screen and an independent
 *   confirmation batch. A single measurement is not enough in either direction, and the
 *   reason is empirical rather than tidy. The same group has now been reported by three
 *   consecutive hosted runs as **−3.93% inconclusive**, **−6.40% regression with an interval
 *   of [−7.1%, −5.7%]**, and **−3.44% cleared**. Under the interval rule `cleared` means the
 *   whole interval sits inside ±5% and `regression` means it sits at or below −5%: those two
 *   cannot both be true of one quantity, so the between-run variation exceeds what the
 *   within-run interval captures. That is the between-runner fixed effect this repository
 *   argued about, demonstrated by this list's own rot check rather than reasoned about — a
 *   cell keeps its shard for every repetition, so a runner-dependent shift in its ratio moves
 *   the estimate without widening the interval.
 *
 *   The consequence is a rule, not a caveat: if a cross-shard screen cannot support blocking
 *   a group, it cannot support un-acknowledging one either. Otherwise the entry can neither
 *   exist nor not exist without failing on some runs, which is a gate no author can satisfy —
 *   and that is exactly what happened on `e4ed510`.
 *
 *   Where the evidence is missing the check is **unassessed** and says so. An unassessed rot
 *   check that reads as "checked and fine" is the failure mode this mechanism exists to
 *   avoid, so it is reported by name and never silently treated as a pass.
 * - **A cell nobody measured is not evidence either way.** A scoped run that never selected
 *   an acknowledged cell leaves its entry untouched rather than stale.
 */

/**
 * @typedef {object} AcceptedRegression
 * @property {string} cell The cell id, as the catalog declares it.
 * @property {number} maxRegressionPercent How far down is accepted, as a positive percentage.
 * Judged as a decision threshold against each stage's **interval**, not against a point
 * estimate: an interval wholly past it is a breach, wholly inside it is within bound, and one
 * spanning it is unassessed. A breach blocks only when both batches reproduce it.
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
			+ 'path that is already the slow one. Rechecked once the bound became interval-judged rather than '
			+ 'point-judged: the widest interval any run produced for this cell is [−18.2%, −10.9%], which sits inside 25% '
			+ 'with 6.8pp to spare, so the number set from point estimates survives the stricter reading unchanged.',
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
			+ '`map`: the wrong index is a wrong answer, and this is the failure-collection path only. Rechecked under '
			+ 'interval semantics: every observed interval still sits inside 45% — the widest, [−42.9%, +26.1%] from the '
			+ 'run where this cell was too noisy to judge, by only 2.1pp — so the bound holds but thinly, and a noisier '
			+ 'run will report this entry `unassessed` rather than acknowledged. That is the honest outcome and it blocks '
			+ 'nothing; the bound is deliberately not widened to make it read as acknowledged.',
	},
]

/**
 * Groups whose aggregate has a separately accepted regression. This is intentionally
 * independent from cell acknowledgements: accepting one or more cells never suppresses a
 * broad group regression. Entries are removed once a whole-group single-runner confirmation
 * shows the cost has cleared.
 */
/** @type {{ group: string, maxRegressionPercent: number, because: string }[]} */
export const acceptedGroupRegressions = []

const minimumReasonLength = 200

/** A classification that says the cost is not there: the only kind that can retire an entry. */
const saysCostIsGone = classification => classification === 'cleared' || classification === 'improvement'

/** Rows whose measurement claims a regression, which is what an acknowledgement can cover. */
function claimsRegression(row) {
	return row.screen === 'severe' || row.screen === 'regression'
		|| row.confirm === 'severe' || row.confirm === 'regression'
}

/**
 * How one stage's interval stands against a bound.
 *
 * A bound is a decision threshold, so it gets the semantics every other threshold in this gate
 * has: the interval decides, not the point estimate. `breach` is an interval wholly worse than
 * the bound, `within` wholly inside it, `spanning` neither — a measurement that cannot place
 * the cost on either side of the number a person agreed to.
 *
 * This replaces a point-estimate test that reintroduced both failure modes the rest of the gate
 * was hardened against. With a 45% bound, a noisy screen at −60% and a confirmation `cleared`
 * at 0% was reported as a breach and failed the workflow — while the same row *without* an
 * acknowledgement would have been `not-reproduced` and would not have blocked, so adding an
 * acknowledgement made the gate stricter than having none. In the other direction a −40% point
 * estimate whose interval ran past −45% was accepted, although the measurement could not
 * establish the cost was inside the bound.
 */
export function boundStanding(low, high, maxRegressionPercent) {
	const threshold = -maxRegressionPercent / 100
	if (!Number.isFinite(low) || !Number.isFinite(high))
		return 'spanning'
	if (high <= threshold)
		return 'breach'
	if (low > threshold)
		return 'within'
	return 'spanning'
}

/** The deepest regression either stage measured, as a positive percentage. Reported, not decisive. */
export function deepestRegressionPercent(row) {
	const deltas = [row.screenDelta, row.confirmDelta].filter(delta => typeof delta === 'number')
	return deltas.length === 0 ? 0 : Math.max(0, -Math.min(...deltas) * 100)
}

/**
 * Two stages against one bound, and what may follow from them.
 *
 * A breach is a blocking action, so it needs independent reproduction exactly like an ordinary
 * severe regression: both stages must place the whole interval past the bound. One stage
 * breaching while the other does not is `unassessed` — a disagreement between batches is a
 * question for a reader, never a red gate from whichever batch produced the deeper estimate.
 */
export function combineBoundStandings(screen, confirm) {
	if (screen === 'breach' && confirm === 'breach')
		return { outcome: 'breach', why: 'both batches place the whole interval past the bound' }
	if (screen === 'breach' || confirm === 'breach') {
		return {
			outcome: 'unassessed',
			why: `one batch places the whole interval past the bound and the other reports it ${screen === 'breach' ? (confirm ?? 'not at all') : screen}, `
				+ 'so the breach is not independently reproduced',
		}
	}
	if (screen === 'within' && (confirm === 'within' || confirm == null))
		return { outcome: 'within', why: 'the measured interval sits inside the bound' }
	if (screen == null && confirm === 'within')
		return { outcome: 'within', why: 'the measured interval sits inside the bound' }
	return { outcome: 'unassessed', why: 'the interval spans the bound, so this run cannot place the cost on either side of it' }
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
/**
 * How the group list stands, judged **only** on single-runner confirmation evidence.
 *
 * Nothing about an acknowledged group is decided from the cross-shard screen — not that it is
 * still regressing, not that it has stopped, and not that it has breached its bound. The screen
 * mixes runners, and a cell keeps its shard across every repetition, so its group aggregate can
 * be tight and displaced at the same time; the three readings of `warm/failure/all` in the
 * module header are what that looks like in practice. Blocking already required a single-runner
 * batch, and the same evidence is required to retire an entry or to fail on its bound.
 *
 * `confirmation` carries the confirmation comparison's group rows, whether it ran on one
 * runner, and whether it measured the whole group. Anything short of all three leaves the entry
 * **unassessed**, reported by name.
 */
export function evaluateAcceptedGroupRegressions(screenGroups, confirmation, entries = acceptedGroupRegressions) {
	const { groups: confirmGroups = [], singleRunner = false, measuredWhole = () => false } = confirmation ?? {}
	const byName = new Map(confirmGroups.map(group => [group.group, group]))
	const screenByName = new Map(screenGroups.map(group => [group.group, group]))
	const acknowledged = []
	const exceeded = []
	const stale = []
	const unassessed = []
	for (const entry of entries) {
		const screen = screenByName.get(entry.group) ?? null
		if (screen == null)
			continue
		const confirmed = byName.get(entry.group) ?? null
		if (!singleRunner || !measuredWhole(entry.group) || confirmed == null || confirmed.delta == null) {
			unassessed.push({
				group: entry.group,
				screen: screen.classification,
				screenDelta: screen.delta,
				why: !singleRunner
					? 'no single-runner confirmation measured this group, and a cross-shard screen cannot retire an entry it could not use to block one'
					: !measuredWhole(entry.group)
							? 'the confirmation batch did not measure every cell of the group, so its aggregate would be over an outcome-selected subset'
							: 'the confirmation batch produced no aggregate for this group',
			})
			continue
		}
		if (saysCostIsGone(confirmed.classification)) {
			stale.push({ group: entry.group, screen: confirmed.classification, screenDelta: confirmed.delta })
			continue
		}
		if (confirmed.classification !== 'regression') {
			unassessed.push({
				group: entry.group,
				screen: confirmed.classification,
				screenDelta: confirmed.delta,
				why: `the single-runner confirmation reports it ${confirmed.classification}, which neither confirms the accepted cost nor shows it gone`,
			})
			continue
		}
		const confirmStanding = boundStanding(confirmed.intervalLow, confirmed.intervalHigh, entry.maxRegressionPercent)
		const screenStanding = screen.intervalLow == null ? null : boundStanding(screen.intervalLow, screen.intervalHigh, entry.maxRegressionPercent)
		const combined = combineBoundStandings(screenStanding, confirmStanding)
		const record = {
			group: entry.group,
			bound: entry.maxRegressionPercent,
			depthPercent: Math.max(0, -confirmed.delta * 100),
			because: entry.because,
		}
		if (combined.outcome === 'breach')
			exceeded.push({ ...record, why: combined.why })
		else if (combined.outcome === 'within')
			acknowledged.push(record)
		else
			unassessed.push({ group: entry.group, screen: confirmed.classification, screenDelta: confirmed.delta, why: `its bound cannot be judged: ${combined.why}` })
	}
	return { acknowledged, exceeded, stale, unassessed }
}

export function evaluateAcceptedRegressions(rows, entries = acceptedRegressions) {
	const byCell = new Map(entries.map(entry => [entry.cell, entry]))
	const acknowledged = []
	const exceeded = []
	const stale = []
	const unassessed = []
	for (const row of rows) {
		const entry = byCell.get(row.scenario)
		if (entry == null)
			continue
		if (saysCostIsGone(row.screen)) {
			// Both measurements, or neither. A cleared screen is one measurement on one shard, and
			// a cell keeps that shard across every repetition, so its interval cannot see a
			// runner-dependent shift in its own ratio — the same defect that makes a cross-shard
			// group interval overconfident. An acknowledged cell is therefore always queued for the
			// confirmation batch, so this normally has two readings to compare rather than one.
			if (row.confirm == null)
				unassessed.push({ cell: entry.cell, why: `the screen reports it ${row.screen} at ${(row.screenDelta * 100).toFixed(2)}%, but no confirmation batch measured it, so one reading cannot retire the entry` })
			else if (saysCostIsGone(row.confirm))
				stale.push({ cell: entry.cell, screen: row.screen, screenDelta: row.screenDelta, confirm: row.confirm, confirmDelta: row.confirmDelta })
			else
				unassessed.push({ cell: entry.cell, why: `the screen reports it ${row.screen} at ${(row.screenDelta * 100).toFixed(2)}% while the confirmation batch reports it ${row.confirm}, so the two do not agree that the cost is gone` })
			continue
		}
		if (!claimsRegression(row))
			continue
		const screenStanding = row.screenLow == null ? null : boundStanding(row.screenLow, row.screenHigh, entry.maxRegressionPercent)
		const confirmStanding = row.confirmLow == null ? null : boundStanding(row.confirmLow, row.confirmHigh, entry.maxRegressionPercent)
		const combined = combineBoundStandings(screenStanding, confirmStanding)
		const record = {
			cell: entry.cell,
			bound: entry.maxRegressionPercent,
			depthPercent: deepestRegressionPercent(row),
			because: entry.because,
		}
		if (combined.outcome === 'breach')
			exceeded.push({ ...record, why: combined.why })
		else if (combined.outcome === 'within')
			acknowledged.push(record)
		else
			unassessed.push({ cell: entry.cell, why: `its bound cannot be judged: ${combined.why}` })
	}
	return { acknowledged, exceeded, stale, unassessed }
}
