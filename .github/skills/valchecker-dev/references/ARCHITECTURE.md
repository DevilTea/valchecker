# Valchecker Project Architecture

## Complete Directory Structure

```
valchecker/
├── .github/
│   ├── skills/
│   │   └── valchecker-dev/        # Development skills
│   │       ├── SKILL.md
│   │       ├── references/        # Detailed guides
│   │       └── scripts/           # Automation scripts
│   └── workflows/                 # CI/CD workflows
├── packages/
│   ├── valchecker/
│   │   ├── src/
│   │   │   └── index.ts           # Public API export
│   │   ├── dist/                  # Compiled output (ESM + CJS)
│   │   ├── package.json
│   │   └── tsconfig.*.json
│   │
│   ├── all-steps/
│   │   ├── src/
│   │   │   ├── allSteps/
│   │   │   │   ├── allSteps.ts    # Master step array
│   │   │   │   ├── allSteps.test.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── dist/                  # Compiled output
│   │   └── package.json
│   │
│   └── internal/
│       ├── src/
│       │   ├── core/
│       │   │   ├── types.ts       # Core type definitions
│       │   │   ├── core.ts        # Execution engine
│       │   │   ├── core.test.ts   # 1195 lines of tests
│       │   │   └── index.ts
│       │   │
│       │   ├── steps/             # 45+ validation steps
│       │   │   ├── string/
│       │   │   │   ├── string.ts
│       │   │   │   ├── string.test.ts
│       │   │   │   └── index.ts
│       │   │   ├── number/
│       │   │   ├── object/
│       │   │   ├── array/
│       │   │   ├── union/
│       │   │   ├── intersection/
│       │   │   ├── check/
│       │   │   ├── transform/
│       │   │   ├── fallback/
│       │   │   ├── use/
│       │   │   ├── toAsync/
│       │   │   ├── toUppercase/
│       │   │   ├── toLowercase/
│       │   │   ├── parseJSON/
│       │   │   ├── stringifyJSON/
│       │   │   └── ... (35+ more steps)
│       │   │
│       │   ├── shared/
│       │   │   ├── shared.ts      # Utilities and constants
│       │   │   └── index.ts
│       │   └── index.ts
│       │
│       ├── dist/                  # Compiled output
│       ├── package.json
│       └── vitest.config.ts
│
├── docs/                          # Documentation site
├── coverage/                      # Test coverage reports
├── scripts/
│   └── newpkg.ts                  # Package creation script
├── AGENTS.md                      # Development constitution
├── README.md                      # Project readme
├── package.json                   # Root package
├── pnpm-workspace.yaml            # Monorepo configuration
├── vitest.config.ts               # Test configuration
├── eslint.config.js               # Linting configuration
└── tsconfig.json                  # Root TypeScript config
```

## Package Dependencies

```
valchecker (public)
  ├── @valchecker/all-steps
  │   └── @valchecker/internal
  │       └── (type-fest, @standard-schema/spec)
  └── @valchecker/internal

all-steps
  └── @valchecker/internal

internal
  └── (type-fest, @standard-schema/spec)
```

## Step Categories (45+ steps)

### Primitive Types (12 steps)
- `any`, `unknown`, `never`
- `string`, `number`, `boolean`
- `null_`, `undefined_`
- `bigint`, `symbol`
- `literal`

### Composite Types (5 steps)
- `object`, `array`
- `union`, `intersection`
- `generic`

### Operators (15+ steps)
- `check` - Custom validation
- `transform` - Value transformation
- `fallback` - Fallback values
- `use` - Schema delegation
- `toAsync` - Async conversion

### String Operations (7 steps)
- `toUppercase`, `toLowercase`, `toTrimmed`
- `toTrimmedStart`, `toTrimmedEnd`
- `startsWith`, `endsWith`

### Number Operations (3 steps)
- `min`, `max`
- `integer`, `looseNumber`

### Array Operations (6 steps)
- `toSorted`, `toFiltered`, `toSliced`
- `toLength`

### Advanced (4+ steps)
- `parseJSON`, `stringifyJSON`
- `strictObject`, `looseObject`
- `as`, `index`, `instance`

## File Responsibilities

### Core Files

| Path | Purpose | Criticality |
|------|---------|------------|
| `packages/internal/src/core/types.ts` | Type system definitions | Critical |
| `packages/internal/src/core/core.ts` | Execution engine | Critical |
| `packages/valchecker/src/index.ts` | Public API | Critical |
| `packages/all-steps/src/allSteps/allSteps.ts` | Step registry | High |
| `packages/internal/src/shared/shared.ts` | Common utilities | High |

### Step Implementation Pattern

Each step directory contains:
- `[name].ts` - Implementation using `implStepPlugin()`
- `[name].test.ts` - Unit tests (100% coverage)
- `[name].bench.ts` - Performance benchmarks
- `index.ts` - Re-export

## Build System

- **Build Tool**: tsdown (replaced unbuild in migration)
- **Package Format**: ESM + CJS dual export
- **Type Definitions**: Generated `.d.mts` and `.d.cts` files
- **Output**: All packages build to `dist/` directory

## Test Infrastructure

- **Framework**: Vitest
- **Coverage**: v8 coverage reporter
- **Watch Mode**: Supported
- **Benchmarks**: Vitest bench format
- **Coverage Target**: 100% for new code

## Type System Architecture

Valchecker uses advanced TypeScript:
- Conditional types for step composition
- Mapped types for parameter derivation
- Type overloads for API ergonomics
- Generic constraints for type safety
- Proxy-based type evolution tracking

## Performance Optimization Points

1. **Pipeline Execution** (`createPipeExecutor`):
   - Direct loop execution without overhead
   - Async detection with Promise checks
   - Pre-computed branch executors

2. **Hot Paths**:
   - Union step branch selection
   - Intersection step merging
   - Array iteration and transformation

3. **Memory**:
   - Array pre-allocation with known sizes
   - Avoid unnecessary spreads
   - Reuse objects when possible

## Integration Points

- **Standard Schema**: Compliant with Standard Schema specification
- **ESLint**: Custom @deviltea/eslint-config
- **TypeScript**: Custom @deviltea/tsconfig
- **Dependencies**: All pinned in pnpm catalog

---

See STEP_IMPLEMENTATION.md for step-specific details.
