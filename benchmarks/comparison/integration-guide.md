# Integration Guide for typescript-runtime-type-benchmarks

This guide provides step-by-step instructions for adding valchecker to the typescript-runtime-type-benchmarks project for comparison with other validation libraries.

## Prerequisites

- Node.js 18+ or Bun/Deno
- Git
- npm or pnpm

## Step-by-Step Integration

### 1. Clone the Benchmark Repository

```bash
git clone https://github.com/moltar/typescript-runtime-type-benchmarks.git
cd typescript-runtime-type-benchmarks
```

### 2. Add Valchecker Case File

Copy the valchecker case file to the cases directory:

```bash
# From valchecker repository
cp benchmarks/comparison/valchecker-case.ts /path/to/typescript-runtime-type-benchmarks/cases/valchecker.ts
```

Or create `cases/valchecker.ts` manually with the following content:

```typescript
import { createValchecker, object, string, number, boolean } from 'valchecker';
import { createCase } from '../benchmarks';

const v = createValchecker({ 
  steps: [object, string, number, boolean] 
});

createCase('valchecker', 'parseSafe', () => {
  const dataType = v.object({
    number: v.number(),
    negNumber: v.number(),
    maxNumber: v.number(),
    string: v.string(),
    longString: v.string(),
    boolean: v.boolean(),
    deeplyNested: v.object({
      foo: v.string(),
      num: v.number(),
      bool: v.boolean(),
    }),
  });

  return (data) => {
    const result = dataType.execute(data);
    if (dataType.isSuccess(result)) {
      return result.value;
    }
    throw new Error('Validation failed');
  };
});

createCase('valchecker', 'parseStrict', () => {
  const dataType = v.object({
    number: v.number(),
    negNumber: v.number(),
    maxNumber: v.number(),
    string: v.string(),
    longString: v.string(),
    boolean: v.boolean(),
    deeplyNested: v.object({
      foo: v.string(),
      num: v.number(),
      bool: v.boolean(),
    }),
  });

  return (data) => {
    const result = dataType.execute(data);
    if (dataType.isSuccess(result)) {
      return result.value;
    }
    throw new Error('Validation failed');
  };
});

createCase('valchecker', 'assertLoose', () => {
  const dataType = v.object({
    number: v.number(),
    negNumber: v.number(),
    maxNumber: v.number(),
    string: v.string(),
    longString: v.string(),
    boolean: v.boolean(),
    deeplyNested: v.object({
      foo: v.string(),
      num: v.number(),
      bool: v.boolean(),
    }),
  });

  return (data) => {
    const result = dataType.execute(data);
    if (dataType.isFailure(result)) {
      throw new Error('Validation failed');
    }
    return true;
  };
});

createCase('valchecker', 'assertStrict', () => {
  const dataType = v.object({
    number: v.number(),
    negNumber: v.number(),
    maxNumber: v.number(),
    string: v.string(),
    longString: v.string(),
    boolean: v.boolean(),
    deeplyNested: v.object({
      foo: v.string(),
      num: v.number(),
      bool: v.boolean(),
    }),
  });

  return (data) => {
    const result = dataType.execute(data);
    if (dataType.isFailure(result)) {
      throw new Error('Validation failed');
    }
    return true;
  };
});
```

### 3. Add Valchecker Dependency

Edit `package.json` and add valchecker to the dependencies:

```json
{
  "dependencies": {
    // ... other dependencies
    "valchecker": "^0.0.18"
  }
}
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Benchmarks

#### Run all benchmarks:
```bash
npm start
```

#### Run with Bun (faster):
```bash
npm run start:bun
```

#### Run with Deno:
```bash
npm run start:deno
```

### 6. View Results

After running the benchmarks:

1. **Console output**: Shows immediate results with ops/sec for each library
2. **Generated files**: Check `docs/results/` directory for detailed results
3. **Visual report**: The project generates graphs comparing all libraries

## What Gets Benchmarked

The benchmark tests four scenarios:

1. **parseSafe**: Parse and return the validated data, throw on error
2. **parseStrict**: Parse with strict mode (no additional properties)
3. **assertLoose**: Validate and return boolean, allow additional properties
4. **assertStrict**: Validate strictly and return boolean

Each scenario tests with standardized data:
```typescript
{
  number: 1,
  negNumber: -1,
  maxNumber: Number.MAX_VALUE,
  string: "string",
  longString: "..." // very long string
  boolean: true,
  deeplyNested: {
    foo: "bar",
    num: 1,
    bool: false
  }
}
```

## Expected Performance Characteristics

Based on internal benchmarks, valchecker should show:

- **Strengths**:
  - Fast simple type validation (~400k+ ops/sec for strings)
  - Good performance on large arrays (5-7% faster than baseline)
  - Efficient string transformations
  - Low memory overhead

- **Trade-offs**:
  - Small object validation may be slower than some competitors
  - Optimization favors larger, more complex structures

## Interpreting Results

The benchmark measures:
- **ops/sec**: Operations per second (higher is better)
- **margin**: Statistical margin of error (lower is better)
- **relative performance**: Comparison against fastest library

### Comparing Libraries

The project compares against major libraries:
- **zod**: Popular schema validation
- **yup**: Widely used in forms
- **joi**: Enterprise validation
- **ajv**: JSON Schema validator
- **typebox**: Fast TypeScript schemas
- **valibot**: Modular validation
- And 50+ more...

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run test:build
```

### Import Errors

Ensure valchecker is properly installed:

```bash
npm list valchecker
```

If missing:
```bash
npm install valchecker@latest
```

### Case File Not Found

Verify the case file exists:
```bash
ls -la cases/valchecker.ts
```

## Contributing Results Upstream

To add valchecker to the official benchmark project:

1. Fork the typescript-runtime-type-benchmarks repository
2. Add the valchecker case file
3. Update package.json with valchecker dependency
4. Test locally to ensure it works
5. Submit a PR with:
   - The case file
   - Package.json update
   - Brief description of valchecker

## Additional Resources

- [typescript-runtime-type-benchmarks](https://github.com/moltar/typescript-runtime-type-benchmarks)
- [Live Benchmark Results](https://moltar.github.io/typescript-runtime-type-benchmarks)
- [Valchecker Repository](https://github.com/DevilTea/valchecker)
- [Valchecker Documentation](https://github.com/DevilTea/valchecker#readme)

## Notes

- The benchmark project is actively maintained
- Results are published automatically via GitHub Actions
- Benchmarks run on standardized hardware for consistency
- All libraries use their recommended patterns and configurations
