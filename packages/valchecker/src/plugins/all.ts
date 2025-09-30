import { array } from './array'
import { bigint } from './bigint'
import { boolean } from './boolean'
import { check } from './check'
import { fallback } from './fallback'
import { max } from './max'
import { min } from './min'
import { null_ } from './null_'
import { number } from './number'
import { string } from './string'
import { symbol } from './symbol'
import { toFiltered } from './toFiltered'
import { toIsEvery } from './toIsEvery'
import { toIsIncluding } from './toIsIncluding'
import { toIsSome } from './toIsSome'
import { toJoined } from './toJoined'
import { toLength } from './toLength'
import { toLowerCase } from './toLowerCase'
import { toMapped } from './toMapped'
import { toReversed } from './toReversed'
import { toSliced } from './toSliced'
import { toSorted } from './toSorted'
import { toSpliced } from './toSpliced'
import { toString } from './toString'
import { toTrimmed } from './toTrimmed'
import { toUpperCase } from './toUpperCase'
import { transform } from './transform'
import { undefined_ } from './undefined_'

export const all = [
	// data type
	array,
	bigint,
	boolean,
	null_,
	number,
	string,
	symbol,
	undefined_,
	// check
	check,
	min,
	max,
	// transform
	transform,
	toString,
	toTrimmed,
	toLowerCase,
	toUpperCase,
	toMapped,
	toFiltered,
	toSorted,
	toSliced,
	toSpliced,
	toLength,
	toIsEvery,
	toIsSome,
	toReversed,
	toIsIncluding,
	toJoined,
	// fallback
	fallback,
]
