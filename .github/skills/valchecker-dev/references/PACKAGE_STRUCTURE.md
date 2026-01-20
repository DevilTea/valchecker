# Valchecker Package Structure

## Package-by-Package Overview

### 1. valchecker (Main Package)

**npm name**: `valchecker`
**Location**: `packages/valchecker/`
**Purpose**: Public entry point for users

**Key Files**:
```
src/
└── index.ts              # Single file that exports main API
```

**Exports**:
- `createValchecker()` - Main factory function
- Re-exports from all-steps and internal

**Dependencies**:
```json
{
  "@valchecker/all-steps": "workspace:*",
  "@valchecker/internal": "workspace:*"
}
```

**Build Output**:
- ESM: `dist/index.mjs`
- CJS: `dist/index.cjs`
- Types: `dist/index.d.mts` and `dist/index.d.cts`

### 2. @valchecker/all-steps

**npm name**: `@valchecker/all-steps`
**Location**: `packages/all-steps/`
**Purpose**: Convenience bundle of all available steps

**Key Files**:
```
src/
├── allSteps/
│   ├── allSteps.ts       # Master step array definition
│   ├── allSteps.test.ts  # Bundle tests
│   └── index.ts          # Re-export
└── index.ts              # Package export

vitest.config.ts          # Test configuration
tsdown.config.ts          # Build configuration
```

**Main Export - allSteps**:
```typescript
export const allSteps: StepPluginImpl[] = [
  // Type steps
  any, unknown, never,
  string, number, boolean,
  null_, undefined_,
  bigint, symbol,
  literal,
  
  // Composite steps
  object, array,
  union, intersection,
  generic,
  
  // Operator steps
  check, transform, fallback, use,
  toAsync, as,
  
  // String operations
  toUppercase, toLowercase, toTrimmed,
  toTrimmedStart, toTrimmedEnd,
  startsWith, endsWith,
  
  // Number operations
  min, max, integer, looseNumber,
  
  // Array operations
  toSorted, toFiltered, toSliced, toLength,
  
  // Advanced
  parseJSON, stringifyJSON,
  strictObject, looseObject,
  index, instance,
  empty, endsWith,
  json
]
```

**Dependencies**:
```json
{
  "@valchecker/internal": "workspace:*"
}
```

**Build Output**:
- ESM: `dist/index.mjs`
- CJS: `dist/index.cjs`
- Types: `dist/index.d.mts` and `dist/index.d.cts`

### 3. @valchecker/internal

**npm name**: `@valchecker/internal`
**Location**: `packages/internal/`
**Purpose**: Core implementation - not typically used directly by end users

**Key Subdirectories**:

#### 3.1 src/core/ - Execution Engine

**Files**:
- `types.ts` - All core type definitions (~350 lines)
- `core.ts` - Implementation (~260 lines)
- `core.test.ts` - Comprehensive tests (1195 lines)
- `index.ts` - Re-export

**Critical Types** (in types.ts):
```typescript
// Result types
ExecutionSuccessResult<Output>
ExecutionIssue
ExecutionFailureResult<Issue>
ExecutionResult<Output, Issue>

// Plugin system
TStepPluginDef
TStepMethodMeta
TExecutionContext
TValchecker

// Type inference
DefineExpectedValchecker
InferAllIssue
InferOutput
```

**Critical Functions** (in core.ts):
```typescript
implStepPlugin()         // Mark step plugins
isSuccess()              // Type guard for success
isFailure()              // Type guard for failure
prependIssuePath()       // Path manipulation
createPipeExecutor()     // Performance-critical executor
```

**Test Coverage**:
- 1195 lines of comprehensive tests
- Pipeline execution
- Async handling
- Path tracking
- Error handling

#### 3.2 src/steps/ - Validation Steps (45+ steps)

**Structure**:
```
steps/
├── string/
│   ├── string.ts         # Implementation
│   ├── string.test.ts    # Tests
│   ├── string.bench.ts   # Benchmarks
│   └── index.ts
├── number/
├── boolean/
├── object/
├── array/
├── union/
├── intersection/
├── check/
├── transform/
├── fallback/
├── use/
├── toAsync/
├── toUppercase/
├── toLowercase/
├── toTrimmed/
├── toTrimmedStart/
├── toTrimmedEnd/
├── startsWith/
├── endsWith/
├── min/
├── max/
├── integer/
├── looseNumber/
├── parseJSON/
├── stringifyJSON/
├── strictObject/
├── looseObject/
├── toSorted/
├── toFiltered/
├── toSliced/
├── toLength/
├── literal/
├── null_/
├── undefined_/
├── bigint/
├── symbol/
├── any/
├── unknown/
├── never/
├── generic/
├── as/
├── index/
├── instance/
├── empty/
├── json/
└── index.ts              # Master export of all steps
```

**Each step contains**:
- `[name].ts` - Implementation (50-200 lines typical)
- `[name].test.ts` - Unit tests (100+ coverage)
- `[name].bench.ts` - Performance benchmarks
- `index.ts` - Re-export

#### 3.3 src/shared/ - Utilities

**Files**:
```
shared/
├── shared.ts             # Common utilities and markers
└── index.ts
```

**Exports**:
- Type helpers and utilities
- Runtime markers for step detection
- Shared constants

#### 3.4 src/index.ts - Package Export

```typescript
export * from './core'
export * from './shared'
export * from './steps'
```

**Dependencies**:
```json
{
  "@standard-schema/spec": "catalog:*",
  "type-fest": "catalog:*"
}
```

## Build System

### Build Configuration Files

**tsdown.config.ts** (in each package):
```typescript
// TypeScript to ESM/CJS conversion
// Entry: src/index.ts
// Output: dist/
```

**vitest.config.ts** (in each package):
```typescript
// Test framework configuration
// Includes coverage settings
// Includes bench settings
```

### Output Structure

Each package builds to:
```
dist/
├── index.mjs                    # ESM default
├── index.cjs                    # CJS default
├── index.d.mts                  # ESM types
├── index.d.cts                  # CJS types
└── (package size report)
```

## Package Relationships

```
End User
  ↓
valchecker (main public API)
  ├→ @valchecker/all-steps (convenience)
  │   └→ @valchecker/internal (implementation)
  └→ @valchecker/internal (direct import possible)
```

**Usage Patterns**:

1. **Recommended** - Use main package with all steps:
   ```typescript
   import { createValchecker, allSteps } from 'valchecker'
   const v = createValchecker({ steps: allSteps })
   ```

2. **Selective** - Import only needed steps:
   ```typescript
   import { createValchecker, string, number } from 'valchecker'
   const v = createValchecker({ steps: [string, number] })
   ```

3. **Advanced** - Import from internal directly:
   ```typescript
   import { createValchecker } from '@valchecker/internal'
   ```

## TypeScript Configuration

Each package has:

**tsconfig.package.json** - For implementation files
**tsconfig.tests.json** - For test files

Root `tsconfig.json` - Shared base configuration

## npm Publishing

**All packages published to npmjs.com**:
- `valchecker` - Main package
- `@valchecker/all-steps` - Steps bundle
- `@valchecker/internal` - Internal package (for advanced users)

**Version Management**:
- Monorepo-wide version in root `package.json`
- All packages release together
- Version: 0.0.31 (as of last update)

## Development Mode

Run `pnpm stub` to enable:
- Watch compilation in development
- Hot module reload support
- Linked packages for local testing

## Testing Strategy

**Test Distribution**:
- Core tests: `packages/internal/src/core/core.test.ts` (1195 lines)
- Step tests: Individual `[name].test.ts` in each step directory
- Bundle tests: `packages/all-steps/src/allSteps/allSteps.test.ts`

**Coverage Requirements**:
- 100% for new code
- Individual package coverage tracking
- Aggregated coverage reports in `coverage/`

---

See ARCHITECTURE.md for directory structure diagram.
