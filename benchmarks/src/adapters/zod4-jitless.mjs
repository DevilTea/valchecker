import * as z from 'zod4'
import { createZodAdapter } from './zod-factory.mjs'

z.config({ jitless: true })

// The same installed package as `zod4`, measured with generated code disabled, so the
// version it reports is that one pin's.
export default createZodAdapter(z, { adapter: 'zod4-jitless', name: 'Zod 4 (jitless)', specifier: 'zod4' })
