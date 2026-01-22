import type { AllSteps } from '@valchecker/all-steps'
import type { InitialValchecker } from '@valchecker/internal'
import { allSteps } from '@valchecker/all-steps'
import { createValchecker } from '@valchecker/internal'

export const v: InitialValchecker<NonNullable<AllSteps[number]['~def']>> = createValchecker({ steps: allSteps })
