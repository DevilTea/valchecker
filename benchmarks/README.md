# Valchecker Performance Benchmarks

This directory contains performance benchmarks for the valchecker library.

## Running Benchmarks

```bash
# Run all benchmarks
pnpm bench

# Watch mode for development
pnpm bench:watch
```

## Benchmark Files

- **core.bench.ts**: Core functionality benchmarks including createValchecker, object validation, arrays, unions, and complex scenarios
- **steps.bench.ts**: Individual step operation benchmarks including string operations, number validation, transformations, and chaining
- **comparison/**: Integration files for comparing valchecker with other libraries using typescript-runtime-type-benchmarks

## Reports

- **PERFORMANCE_REPORT.md**: Detailed performance analysis comparing baseline vs optimized implementation

## Comparing with Other Libraries

To compare valchecker with other popular validation libraries (zod, yup, joi, ajv, etc.), see:
- **comparison/README.md**: Quick start guide for library comparison
- **comparison/integration-guide.md**: Detailed step-by-step integration instructions
- **comparison/valchecker-case.ts**: Ready-to-use case file for typescript-runtime-type-benchmarks

The [typescript-runtime-type-benchmarks](https://github.com/moltar/typescript-runtime-type-benchmarks) project provides standardized benchmarks across 60+ validation libraries.

## Benchmark Categories

### Core Operations
- Basic type validation (string, number, boolean)
- Object validation (simple, nested, strict)
- Array operations
- Union types
- Complex real-world scenarios

### Step Operations
- String transformations (toLowercase, toUppercase, trim)
- String validation (startsWith, endsWith)
- Number validation (min, max, ranges)
- Custom checks
- Transformations
- Fallbacks
- Chaining operations

## Performance Highlights

- **Array operations**: 5-6% improvement for large arrays (50-100 elements)
- **String transformations**: 4-7% improvement
- **Nested objects**: 2-4% improvement
- **Core validation**: 0.2-0.9% improvement

See PERFORMANCE_REPORT.md for detailed analysis and optimization techniques.
