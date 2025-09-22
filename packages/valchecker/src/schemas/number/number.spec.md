# number.spec.md

Source File: `./number.ts`
Test File: [`./number.test.ts`](./number.test.ts)

## Functionality Summary
- Number schema for validating that input is a number value, with optional NaN allowance.

## Exported Items
- `NumberSchemaTypes`
    - **Description**: Type for number schema types.
    - **Input**: N/A (type definition).
    - **Output**: DefineSchemaTypes with meta allowNaN, output number, issue code EXPECTED_NUMBER.
- `NumberSchemaMessage`
    - **Description**: Type for messages in number schema.
    - **Input**: N/A (type definition).
    - **Output**: SchemaMessage type.
- `NumberSchema`
    - **Description**: Class for number validation.
    - **Input**: Meta with allowNaN.
    - **Output**: Schema instance.
- `number`
    - **Description**: Function to create a number schema.
    - **Input**: Optional allowNaN boolean and message.
    - **Output**: NumberSchema instance.

## Test Cases
- `NumberSchemaTypes`
    - **Note**: Type-only, not runtime testable.
- `NumberSchemaMessage`
    - **Note**: Type-only, not runtime testable.
- `NumberSchema`
    - **Happy Path Cases**
        - [ ] **[NumberSchema.happy.1]** Case 1: Execute with number value, allowNaN false.
            - **Input**: Value 42, allowNaN false.
            - **Expected**: Success with 42.
        - [ ] **[NumberSchema.happy.2]** Case 1: Execute with NaN value, allowNaN true.
            - **Input**: Value NaN, allowNaN true.
            - **Expected**: Success with NaN.
    - **Edge Cases**
        - [ ] **[NumberSchema.edge.1]** Case 1: Execute with NaN value, allowNaN false.
            - **Input**: Value NaN, allowNaN false.
            - **Expected**: Failure with EXPECTED_NUMBER.
    - **Error Cases**
        - [ ] **[NumberSchema.error.1]** Case 1: Execute with string value.
            - **Input**: Value '42'.
            - **Expected**: Failure with EXPECTED_NUMBER.
        - [ ] **[NumberSchema.error.2]** Case 1: Execute with boolean value.
            - **Input**: Value true.
            - **Expected**: Failure with EXPECTED_NUMBER.
        - [ ] **[NumberSchema.error.3]** Case 1: Execute with null value.
            - **Input**: Value null.
            - **Expected**: Failure with EXPECTED_NUMBER.
        - [ ] **[NumberSchema.error.4]** Case 1: Execute with undefined value.
            - **Input**: Value undefined.
            - **Expected**: Failure with EXPECTED_NUMBER.
        - [ ] **[NumberSchema.error.5]** Case 1: Execute with object value.
            - **Input**: Value {}.
            - **Expected**: Failure with EXPECTED_NUMBER.
- `number`
    - **Happy Path Cases**
        - [ ] **[number.happy.1]** Case 1: Create number schema without allowNaN.
            - **Input**: No arguments.
            - **Expected**: NumberSchema instance with allowNaN false.
        - [ ] **[number.happy.2]** Case 1: Create number schema with allowNaN true.
            - **Input**: allowNaN true.
            - **Expected**: NumberSchema instance with allowNaN true.
        - [ ] **[number.happy.3]** Case 1: Create number schema with message.
            - **Input**: message.
            - **Expected**: NumberSchema instance with allowNaN false and message.
