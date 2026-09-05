/**
 * Pattern sources for the bounded ISO 8601 extended time profile shared by
 * `isIsoTime()` and `isIsoDateTime()`.
 *
 * Time of day and UTC-offset grammars are deliberately separate. End-of-day
 * notation permits hour `24` only as `24:00:00` (optionally followed by an
 * all-zero decimal fraction), while an offset must never become `+24:00` just
 * because time-of-day gains that special representation.
 *
 * The ordinary time branch keeps the existing complete extended shape:
 * `HH:MM:SS` with hour 00-23, minute/second 00-59, and an optional fractional
 * second. Either ISO decimal sign (`.` or `,`) is accepted. Leap-second `:60`
 * remains outside this bounded profile by contract.
 *
 * Neither source wraps itself for quantification at call sites.
 */
const isoClockHourSource = String.raw`(?:[01]\d|2[0-3])`
const isoMinuteSource = String.raw`[0-5]\d`
const isoSecondSource = String.raw`[0-5]\d`
const isoFractionSource = String.raw`[.,]\d+`

/** `±HH:MM` offset body; hour remains 00-23 and minute 00-59. */
export const isoUtcOffsetSource = String.raw`${isoClockHourSource}:${isoMinuteSource}`

/**
 * `HH:MM:SS` time of day with optional fractional seconds, plus ISO's special
 * end-of-day representation `24:00:00` whose optional fraction must be zero.
 */
export const isoTimeSource = String.raw`(?:${isoClockHourSource}:${isoMinuteSource}:${isoSecondSource}(?:${isoFractionSource})?|24:00:00(?:[.,]0+)?)`
