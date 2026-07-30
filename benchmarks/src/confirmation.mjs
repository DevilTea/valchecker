/**
 * The two-stage gate: a fixed **screen** over every selected cell, and a fixed independent
 * **confirm** batch over the rows that could block, judged on its own rather than pooled.
 *
 * What this replaces, and why. The plan of record was to re-run every `inconclusive` cell
 * for k more paired repetitions, pool them with the first pass, and judge once. That is
 * optional stopping wearing a precision target: the set being extended is chosen by the
 * first result, so the second judgement is taken on a sample that exists because the first
 * one was unsettled. Pre-declaring the rule and applying it uniformly bounds the damage but
 * does not remove it.
 *
 * Two fixed batches remove it instead. Each stage measures a fixed number of paired
 * repetitions and is judged by the rule in `impact-verdict.mjs` with no knowledge of the
 * other, and this module combines the two verdicts. Nothing is pooled, nothing is
 * re-judged, and neither stage's sample size depends on what it found.
 *
 * The combination, which is the whole decision:
 *
 * | screen | confirm | resolution | effect |
 * | --- | --- | --- | --- |
 * | severe | severe or regression | `reproduced` | fails the gate |
 * | severe | inconclusive | `unresolved` | review, and the gate does not pass |
 * | severe | cleared or improvement | `not-reproduced` | passes, with a noise diagnostic |
 * | regression | severe or regression | `reproduced` | review |
 * | regression | cleared or improvement | `not-reproduced` | passes, with a noise diagnostic |
 * | inconclusive | anything | reported, never blocking | — |
 *
 * **Rows only.** A group verdict is not confirmed here, and that is a limit rather than an
 * omission. The confirm batch measures a set chosen by the screen's outcome, so a group
 * aggregate over it would be conditioned on exactly what `groupEstimate` was rebuilt to
 * avoid — the bias would be worse than the unconfirmed trigger. Confirming a group means
 * re-measuring the whole group, which is 124 cells for `warm/success`. So the severe-group
 * trigger still fires from the screen stage's estimate over every cell selected into the
 * group, and this module carries it through unchanged.
 */

import { meaningfulThreshold } from './impact-verdict.mjs'

/** Fixed paired repetitions per stage. Both stages are the same size on purpose. */
export const screenRepetitions = 5
export const confirmRepetitions = 5

/**
 * Which cells the confirmation batch measures.
 *
 * Two kinds, and no others:
 *
 * - every candidate regression, `severe` or not. A claimed regression is what an
 *   independent reproduction is for;
 * - every `inconclusive` row whose interval reaches at or below −5%. An inconclusive row
 *   always spans *some* threshold — that is what makes it inconclusive — so the qualifier
 *   is which one: a row whose interval could still be a blocking regression is worth
 *   another batch, and one sitting between −4% and +6% is a question about an improvement
 *   nobody is gated on.
 *
 * An `improvement` and a `cleared` row are not re-measured. Neither can block, and
 * spending the batch on them would make the stage cost scale with the run rather than with
 * what is at stake. In the hosted-runner null runs this selects 6 of 170 cells in the
 * quieter run and 47 in the noisier one.
 */
export function confirmationSelection(screen) {
	const boundary = -meaningfulThreshold / 100
	return screen.rows
		.filter(row => row.classification === 'severe' || row.classification === 'regression'
			|| (row.classification === 'inconclusive' && row.intervalLow <= boundary))
		.map(row => ({
			scenario: row.scenario,
			reason: row.classification === 'inconclusive' ? 'boundary' : row.classification,
		}))
		.sort((left, right) => (left.scenario < right.scenario ? -1 : left.scenario > right.scenario ? 1 : 0))
}

function resolutionOf(confirmClassification) {
	if (confirmClassification == null)
		return 'unmeasured'
	if (confirmClassification === 'severe' || confirmClassification === 'regression')
		return 'reproduced'
	if (confirmClassification === 'inconclusive')
		return 'unresolved'
	return 'not-reproduced'
}

/**
 * The final verdict: the screen's, corrected by what the confirmation batch found.
 *
 * `confirm` is `null` when no cell needed confirming, which is the common case on a clean
 * pull request and is not the same as a confirmation that found nothing — the report says
 * which.
 */
export function resolveConfirmation(screen, confirm) {
	const selection = confirmationSelection(screen)
	const confirmByScenario = new Map((confirm?.rows ?? []).map(row => [row.scenario, row]))
	const rows = selection.map(({ scenario, reason }) => {
		const screenRow = screen.rows.find(row => row.scenario === scenario)
		const confirmRow = confirmByScenario.get(scenario) ?? null
		return {
			scenario,
			reason,
			screen: screenRow.classification,
			screenDelta: screenRow.delta,
			confirm: confirmRow?.classification ?? null,
			confirmDelta: confirmRow?.delta ?? null,
			resolution: confirm == null ? 'unconfirmed' : resolutionOf(confirmRow?.classification),
		}
	})

	// A severe screen row is the only row that fails the gate on its own, so it is the only
	// one whose resolution can. Reproduced fails; inconclusive or unmeasured leaves the
	// question open, which is not a pass; cleared says the screen measured noise.
	const severeRows = rows.filter(row => row.screen === 'severe')
	const blocking = severeRows.filter(row => row.resolution === 'reproduced' || row.resolution === 'unconfirmed')
	const unresolved = severeRows.filter(row => row.resolution === 'unresolved' || row.resolution === 'unmeasured')
	const notReproduced = rows.filter(row => row.resolution === 'not-reproduced')
	const reproduced = rows.filter(row => row.resolution === 'reproduced')

	const verdict = blocking.length > 0 || screen.severeGroups.length > 0
		? 'regression'
		: unresolved.length > 0
			? 'unresolved'
			: reproduced.length > 0
				? 'review'
				// Nothing blocking survived the second batch, so the screen's own verdict stands
				// — including `inconclusive`, which stays not-a-pass, and `improvement`.
				: screen.verdict === 'regression' ? 'review' : screen.verdict

	return {
		schemaVersion: 1,
		verdict,
		screenVerdict: screen.verdict,
		confirmed: confirm != null,
		repetitions: { screen: screenRepetitions, confirm: confirmRepetitions },
		/** The screen stage's group trigger, carried through: it is not confirmed here. */
		severeGroups: screen.severeGroups,
		rows,
		blocking: blocking.map(row => row.scenario),
		unresolved: unresolved.map(row => row.scenario),
		reproduced: reproduced.map(row => row.scenario),
		/** Rows the second batch did not reproduce: the screen's own noise, measured. */
		notReproduced: notReproduced.map(row => row.scenario),
	}
}

export function renderConfirmationMarkdown(result) {
	const lines = [
		'## Confirmation stage',
		'',
		`Verdict: **${result.verdict}** · screen verdict: **${result.screenVerdict}** · `
		+ `${result.repetitions.screen} screened + ${result.repetitions.confirm} confirming paired repetitions.`,
		'',
		'Two fixed batches, judged independently. The confirmation batch is a second measurement of the rows that could block — '
		+ 'every candidate regression, and every inconclusive row whose interval reaches −5% — and it is **not** pooled with the first: '
		+ 'adding samples to a set chosen by the first result until the interval settles is optional stopping, whatever the stopping rule is called. '
		+ 'A group verdict is not confirmed here, because the confirmation set is chosen by the screen\'s outcome and a group aggregate over it '
		+ 'would carry exactly the conditioning the group estimator exists to avoid.',
		'',
	]

	if (result.rows.length === 0) {
		lines.push('No row claimed a regression or came within the decision boundary, so there was nothing to confirm.', '')
		return `${lines.join('\n')}\n`
	}

	if (!result.confirmed) {
		lines.push(`> **Not confirmed.** ${result.rows.length} row${result.rows.length === 1 ? '' : 's'} needed a second batch and none ran, `
			+ 'so every one of them is reported as `unconfirmed` and a severe row among them still blocks.', '')
	}

	lines.push(
		'| Cell | Selected because | Screen | Confirm | Resolution |',
		'| --- | --- | ---: | ---: | --- |',
	)
	for (const row of result.rows) {
		lines.push(
			`| \`${row.scenario}\` | ${row.reason} | ${row.screen} (${(row.screenDelta * 100).toFixed(1)}%) `
			+ `| ${row.confirm == null ? 'n/a' : `${row.confirm} (${(row.confirmDelta * 100).toFixed(1)}%)`} | ${row.resolution} |`,
		)
	}

	if (result.notReproduced.length > 0) {
		lines.push(
			'',
			`> **Noise diagnostic.** ${result.notReproduced.map(scenario => `\`${scenario}\``)
				.join(', ')} claimed a regression in the screen and came back clear in an independent batch. `
				+ 'That is the screen\'s own false-positive rate being measured rather than argued, and it is worth tracking across runs.',
		)
	}

	if (result.unresolved.length > 0) {
		lines.push(
			'',
			`> **Unresolved.** ${result.unresolved.map(scenario => `\`${scenario}\``)
				.join(', ')} screened severe and the confirmation batch could not judge ${result.unresolved.length === 1 ? 'it' : 'them'}. `
				+ 'Not a pass and not a failure: two batches that disagree about whether a severe regression is there is a question for a reader, '
				+ 'and re-running until one of them settles is the thing this stage is built to avoid.',
		)
	}

	lines.push('')
	return `${lines.join('\n')}\n`
}
