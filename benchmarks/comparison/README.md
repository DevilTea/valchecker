# Valchecker Comparison with Other Libraries

This directory contains files for comparing valchecker with other validation libraries using the [typescript-runtime-type-benchmarks](https://github.com/moltar/typescript-runtime-type-benchmarks) project.

## Quick Start

### Option 1: Add Valchecker to the Benchmark Project

1. Clone the benchmark project:
   ```bash
   git clone https://github.com/moltar/typescript-runtime-type-benchmarks.git
   cd typescript-runtime-type-benchmarks
   ```

2. Copy the valchecker case file:
   ```bash
   cp /path/to/valchecker/benchmarks/comparison/valchecker-case.ts cases/valchecker.ts
   ```

3. Add valchecker as a dependency in `package.json`:
   ```json
   {
     "dependencies": {
       "valchecker": "^0.0.18"
     }
   }
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Run the benchmarks:
   ```bash
   npm start
   ```

### Option 2: Run Local Development Version

If you want to test the local development version of valchecker:

1. Build valchecker:
   ```bash
   cd /path/to/valchecker
   pnpm build
   pnpm pack
   ```

2. In the benchmark project, install the local package:
   ```bash
   cd /path/to/typescript-runtime-type-benchmarks
   npm install /path/to/valchecker/valchecker-0.0.18.tgz
   ```

3. Copy the case file and run benchmarks as described in Option 1.

## Benchmark Cases

The valchecker case file implements all four benchmark scenarios required by the project:

### 1. parseSafe
Validates data and returns the parsed value. Throws on failure.

### 2. parseStrict
Similar to parseSafe but with strict validation (same behavior for valchecker).

### 3. assertLoose
Validates data and returns true if valid, throws on failure.

### 4. assertStrict
Validates data strictly and returns true if valid, throws on failure.

## Understanding the Results

After running the benchmarks, you can view the results:

1. **Console Output**: Shows operations per second for each library
2. **Generated Report**: Located in `docs/results/` with visual comparisons
3. **Preview**: Available at the project's GitHub Pages

### Performance Metrics

The benchmark measures:
- **ops/sec**: Operations per second (higher is better)
- **margin**: Margin of error in the measurements
- **Runtime**: Node.js, Bun, or Deno version used

## Comparing with Other Libraries

The benchmark project compares valchecker against popular libraries including:
- zod
- yup
- joi
- ajv
- io-ts
- typebox
- valibot
- And many more...

## Current Valchecker Performance

Based on our internal benchmarks:
- Simple object validation: ~86k ops/sec
- String operations: ~400k+ ops/sec
- Array operations (100 objects): ~7.8k ops/sec
- Complex nested structures: ~24k ops/sec

These numbers will be verified and compared against other libraries when integrated with the benchmark project.

## Notes

- The benchmark project uses standardized test data and scenarios
- All libraries are tested under the same conditions
- Results may vary based on hardware and Node.js version
- The project is actively maintained and updated regularly

## Contributing

If you find issues with the valchecker case implementation or have suggestions for improvement:

1. Test locally with the benchmark project
2. Submit issues or PRs to the valchecker repository
3. Consider contributing the case upstream to typescript-runtime-type-benchmarks

## References

- [typescript-runtime-type-benchmarks](https://github.com/moltar/typescript-runtime-type-benchmarks)
- [Benchmark Results](https://moltar.github.io/typescript-runtime-type-benchmarks)
- [Valchecker Documentation](https://github.com/DevilTea/valchecker)
