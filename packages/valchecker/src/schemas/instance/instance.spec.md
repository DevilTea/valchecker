# instance.spec.md

Source File: `./instance.ts`

## Functionality Summary
- Provides an "instance" schema that validates if the input is an instance of a specific constructor using the `instanceof` operator.

## Exported Items (Functions, Classes, Constants, TS Types, etc.)
- `instance`
  - Description: Creates an instance schema for a specific constructor
  - Input: Constructor function and optional message parameter
  - Output: InstanceSchema instance
- `InstanceSchema`
  - Description: Schema class for instance validation
  - Input: Constructor accepts schema options with constructor metadata
  - Output: InstanceSchema instance

## Test Cases (as strictly required for 100% coverage)
- `instance`
  - Happy Path Cases
    - [ ] case 1: Create instance schema for a class
      - Input: `instance(MyClass)`
      - Expected: Returns InstanceSchema instance
    - [ ] case 2: Create instance schema with custom message
      - Input: `instance(MyClass, { INVALID_INSTANCE: 'Custom message' })`
      - Expected: Returns InstanceSchema instance with custom message
  - Edge Cases
    - [ ] case 1: Validate instance of the constructor
      - Input: `schema.validate(new MyClass())`
      - Expected: Return success with the instance
    - [ ] case 2: Validate non-instance values
      - Input: `schema.validate({})`, `schema.validate(null)`, `schema.validate('string')`
      - Expected: All return failure with INVALID_INSTANCE issue
- `InstanceSchema`
  - Happy Path Cases
    - [ ] case 1: Instantiate and validate
      - Input: `new InstanceSchema({ meta: { constructor_: MyClass } }).validate(new MyClass())`
      - Expected: Returns success result with the instance
