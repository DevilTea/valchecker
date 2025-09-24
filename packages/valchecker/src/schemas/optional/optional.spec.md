# optional.spec.md

Source File: `./optional.ts`
Test File: [`./optional.test.ts`](./optional.test.ts)

## Functionality Summary
- Optional schema for making another schema optional, allowing undefined values to pass through.

## Exported Items
- `OptionalSchema`
    - **Description**: Class for optional validation.
    - **Input**: Meta with schema.
    - **Output**: Schema instance.
- `optional`
    - **Description**: Function to create an optional schema.
    - **Input**: Schema to make optional.
    - **Output**: OptionalSchema instance.
- `UnwrapOptional`
    - **Description**: Type to unwrap optional schema.
    - **Input**: Schema.
    - **Output**: Inner schema if optional, else original.
- `unwrapOptional`
    - **Description**: Function to unwrap optional schema.
    - **Input**: Schema.
    - **Output**: Unwrapped schema.

## Test Cases
- `OptionalSchema`
    - **Happy Path Cases**
        - [ ] **[OptionalSchema.happy.1]** Case 1: Execute with undefined input.
            - **Input**: undefined, schema number.
            - **Expected**: Success with undefined.
        - [ ] **[OptionalSchema.happy.2]** Case 1: Execute with valid input.
            - **Input**: 42, schema number.
            - **Expected**: Success with 42.
    - **Error Cases**
        - [ ] **[OptionalSchema.error.1]** Case 1: Execute with invalid input.
            - **Input**: '42', schema number.
            - **Expected**: Failure with issues from number schema.
- `optional`
    - **Happy Path Cases**
        - [ ] **[optional.happy.1]** Case 1: Create optional schema.
            - **Input**: number.
            - **Expected**: OptionalSchema instance.
- `UnwrapOptional`
    - **Note**: Type-only, not runtime testable.
- `unwrapOptional`
    - **Happy Path Cases**
        - [ ] **[unwrapOptional.happy.1]** Case 1: Unwrap optional schema.
            - **Input**: optional(number).
            - **Expected**: number schema.
        - [ ] **[unwrapOptional.happy.2]** Case 1: Unwrap non-optional schema.
            - **Input**: number.
            - **Expected**: number schema.
