/**
 * Proleptic Gregorian calendar dates as one pattern source, shared by the ISO
 * date and date-time validators.
 *
 * This intentionally implements the bounded extended-calendar profile exposed
 * by `isIsoDate()` / `isIsoDateTime()`: exactly four decimal year digits and
 * `YYYY-MM-DD`, not ISO basic, ordinal, week, reduced-precision, expanded-year,
 * or signed-year representations.
 *
 * Month lengths and the leap-year rule are encoded in the alternation instead
 * of being checked by round-tripping through `Date`, which allocated a `Date`
 * and parsed four numbers on every success. The branches are a leap day
 * (`02-29`, only in a year divisible by 4 but not by 100, or divisible by 400),
 * the 31-day months, the 30-day months, and February 1-28.
 *
 * Year `0000` participates in the same proleptic Gregorian rule as every other
 * supported year, so `0000-02-29` is valid: zero is divisible by 400. The old
 * `(?!0000)` exception existed only to preserve a historical `Date.UTC(0, ...)`
 * rollover quirk and is not part of this profile's calendar semantics.
 */
export const isoCalendarDateSource = String.raw`(?:(?:\d\d(?:[2468][048]|[13579][26]|0[48])|(?:[02468][048]|[13579][26])00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|02-(?:0[1-9]|1\d|2[0-8])))`
