// `string-format/*`: one built-in format validator per scenario.
import { warm } from './define.mjs'

// Format fixtures are accepted by every adapter's implementation of the
// corresponding validator, and the invalid values are rejected by all of them,
// so a scenario compares dispatch and pattern cost rather than which library
// happens to admit an exotic edge case.
const stringFormatInputs = {
	email: 'ada.lovelace@example.com',
	invalidEmail: 'ada.lovelace@@example',
	uuid: '3f333df6-90a4-4fda-8dd3-9485d27cee36',
	invalidUuid: '3f333df6-90a4-4fda-8dd3',
	isoDateTime: '2024-03-05T08:09:10.123Z',
	invalidIsoDateTime: '2024-03-05 08:09:10',
}

const emailSteps = ['string', 'isEmail']
const uuidSteps = ['string', 'isUuid']
const isoDateTimeSteps = ['string', 'isIsoDateTime']

// Each library ships its own accepted set for these formats, so the scope is
// a compatible subset: the fixtures are accepted (or rejected) by all of them.
export const stringFormatScenarios = [
	warm('string-format/email-valid', 'standard', 'formatEmail', stringFormatInputs.email, { success: true, output: stringFormatInputs.email }, { comparisonScope: 'compatible-subset', steps: emailSteps }),
	warm('string-format/email-invalid', 'standard', 'formatEmail', stringFormatInputs.invalidEmail, { success: false }, { comparisonScope: 'compatible-subset', steps: emailSteps }),
	warm('string-format/uuid-valid', 'standard', 'formatUuid', stringFormatInputs.uuid, { success: true, output: stringFormatInputs.uuid }, { comparisonScope: 'compatible-subset', steps: uuidSteps }),
	warm('string-format/uuid-invalid', 'full', 'formatUuid', stringFormatInputs.invalidUuid, { success: false }, { comparisonScope: 'compatible-subset', steps: uuidSteps }),
	warm('string-format/iso-date-time-valid', 'standard', 'formatIsoDateTime', stringFormatInputs.isoDateTime, { success: true, output: stringFormatInputs.isoDateTime }, { comparisonScope: 'compatible-subset', steps: isoDateTimeSteps }),
	warm('string-format/iso-date-time-invalid', 'full', 'formatIsoDateTime', stringFormatInputs.invalidIsoDateTime, { success: false }, { comparisonScope: 'compatible-subset', steps: isoDateTimeSteps }),
]
