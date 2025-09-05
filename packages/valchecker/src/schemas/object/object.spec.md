# object.spec.md

Source File: `./object.ts`

## Functionality Summary
- Validates that a value is an object and validates each property against a provided schema structure
- Supports optional properties through OptionalValSchema
- Handles async validation if any property schema is async
- Supports schema transformations and collects transformed values
- Provides detailed validation issues with property paths

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `object`
  - Description: Creates an object schema that validates object properties against a provided structure
  - Input:
    - `struct`: Object structure mapping property keys to ValSchema instances
    - `message?`: Optional custom error messages
  - Output: ObjectSchema instance
- `ObjectSchema`
  - Description: Schema class for object validation with async support and transformations
  - Input: Constructor accepts schema options with struct in meta
  - Output: ObjectSchema instance with proper type inference for async and output types

## Test Cases (as strictly required for 100% coverage)
- `object`
  - Happy Path Cases
    - [ ] case 1: Create object schema with simple structure
      - Input: `object({ name: string() })`
      - Expected: Returns ObjectSchema instance
    - [ ] case 2: Create object schema with custom message
      - Input: `object({ name: string() }, { EXPECTED_OBJECT: 'Custom message' })`
      - Expected: Returns ObjectSchema instance with custom message
  - Edge Cases
    - [ ] case 1: Validate object with all valid properties
      - Input: `schema.validate({ name: 'John', age: 30 })` where schema expects name: string, age: number
      - Expected: Return success with the validated object
    - [ ] case 2: Validate object with invalid properties
      - Input: `schema.validate({ name: 123, age: '30' })` where schema expects name: string, age: number
      - Expected: Return failure with issues for both invalid properties
    - [ ] case 3: Validate object with missing required properties
      - Input: `schema.validate({})` where schema expects name: string
      - Expected: Return failure with issues for missing properties
    - [ ] case 4: Validate object with extra properties
      - Input: `schema.validate({ name: 'John', extra: 'value' })` where schema expects only name: string
      - Expected: Return success (extra properties are allowed)
    - [ ] case 5: Validate non-object value
      - Input: `schema.validate('not an object')` where schema expects object structure
      - Expected: Return failure with EXPECTED_OBJECT error
    - [ ] case 6: Validate null value
      - Input: `schema.validate(null)` where schema expects object structure
      - Expected: Return failure with EXPECTED_OBJECT error
    - [ ] case 7: Validate array value
      - Input: `schema.validate([])` where schema expects object structure
      - Expected: Return failure with EXPECTED_OBJECT error
    - [ ] case 8: Validate undefined value
      - Input: `schema.validate(undefined)` where schema expects object structure
      - Expected: Return failure with EXPECTED_OBJECT error
    - [ ] case 9: Validate with transformed property schemas
      - Input: `schema.validate({ name: 'test' })` where name schema is transformed
      - Expected: Return success with transformed values
    - [ ] case 10: Validate with optional properties present
      - Input: `schema.validate({ name: 'John', optional: 'value' })` where optional is OptionalValSchema
      - Expected: Return success with optional property included
    - [ ] case 11: Validate with optional properties missing
      - Input: `schema.validate({ name: 'John' })` where optional is OptionalValSchema
      - Expected: Return success with optional property undefined
    - [ ] case 12: Validate with custom error message
      - Input: `schema.validate('invalid')` where schema has custom EXPECTED_OBJECT message
      - Expected: Return failure with custom error message
  - Error Cases (if applicable)
    - [ ] case 1: Invalid struct parameter
      - Input: `object(null)` or `object(undefined)`
      - Expected: TypeScript compilation error (struct is required)
- `ObjectSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate simple object
      - Input: `new ObjectSchema({ meta: { struct: { name: string() } } }).validate({ name: 'test' })`
      - Expected: Returns success result with the validated object
    - [ ] case 2: Instantiate and validate with transformations
      - Input: `new ObjectSchema({ meta: { struct: { name: transformedSchema } } }).validate({ name: 'test' })`
      - Expected: Returns success result with transformed values
  - Edge Cases
    - [ ] case 1: Validate empty object struct
      - Input: `new ObjectSchema({ meta: { struct: {} } }).validate({})`
      - Expected: Returns success result with empty object
    - [ ] case 2: Validate with async property schemas
      - Input: `new ObjectSchema({ meta: { struct: { asyncProp: asyncSchema } } }).validate({ asyncProp: 'test' })`
      - Expected: Returns success result after async validation
