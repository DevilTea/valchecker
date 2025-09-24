# array.spec.md

Source File: `./array.ts`
Test File: [`./array.test.ts`](./array.test.ts)

## Functionality Summary
- Array schema for validating that input is an array and validating each item with a provided item schema.

## Exported Items
- `ArraySchema`
    - **Description**: Class for array validation.
    - **Input**: Meta with item schema.
    - **Output**: Schema instance.
- `array`
    - **Description**: Function to create an array schema.
    - **Input**: Item schema and optional message.
    - **Output**: ArraySchema instance.

## Test Cases
- `ArraySchema`
    - **Happy Path Cases**
        - [ ] **[ArraySchema.happy.1]** Case 1: Execute with array of valid items.
            - **Input**: Array of numbers, item schema number.
            - **Expected**: Success with the array.
        - [ ] **[ArraySchema.happy.2]** Case 1: Execute with empty array.
            - **Input**: Empty array, item schema number.
            - **Expected**: Success with empty array.
        - [ ] **[ArraySchema.happy.3]** Case 1: Execute with array of transformed items.
            - **Input**: [1,2,3], item schema pipe(number()).transform(x => x*2).
            - **Expected**: Success with [2,4,6].
    - **Edge Cases**
        - [ ] **[ArraySchema.edge.1]** Case 1: Execute with array containing invalid item.
            - **Input**: [1, '2'], item schema number.
            - **Expected**: Failure with issue at path [1].
    - **Error Cases**
        - [ ] **[ArraySchema.error.1]** Case 1: Execute with string value.
            - **Input**: 'array'.
            - **Expected**: Failure with EXPECTED_ARRAY.
        - [ ] **[ArraySchema.error.2]** Case 1: Execute with object value.
            - **Input**: {}.
            - **Expected**: Failure with EXPECTED_ARRAY.
        - [ ] **[ArraySchema.error.3]** Case 1: Execute with null value.
            - **Input**: null.
            - **Expected**: Failure with EXPECTED_ARRAY.
- `array`
    - **Happy Path Cases**
        - [ ] **[array.happy.1]** Case 1: Create array schema with item schema.
            - **Input**: number schema.
            - **Expected**: ArraySchema instance.
        - [ ] **[array.happy.2]** Case 1: Create array schema with message.
            - **Input**: number schema, message.
            - **Expected**: ArraySchema instance with message.
