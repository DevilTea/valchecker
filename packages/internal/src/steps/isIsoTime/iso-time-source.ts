/**
 * The ISO 8601 time-of-day grammar as pattern sources, shared by `isIsoTime`
 * and by the time and offset halves of `isIsoDateTime`.
 *
 * Field ranges are part of the accepted shape rather than numeric comparisons
 * made after a shape match, so validating allocates nothing and parses nothing.
 * Extracting them also removes a second encoding of the same rule: `isIsoTime`
 * range-checked `Number(match[1]) <= 23` while `isIsoDateTime` already spelled
 * the identical rule as an alternation, and a change to the accepted shape had
 * to be made twice, in two styles, with nothing failing if only one was updated.
 *
 * `isoHourMinuteSource` is separate because the date-time offset (`±HH:MM`)
 * uses exactly the hour and minute rules and nothing else.
 */
export const isoHourMinuteSource = String.raw`(?:[01]\d|2[0-3]):[0-5]\d`

/** `HH:MM:SS` with optional fractional seconds and no time-zone. */
export const isoTimeSource = String.raw`${isoHourMinuteSource}:[0-5]\d(?:\.\d+)?`
