# null.spec.md

Source File: `./null.ts`
Test File: [`./null.test.ts`](./null.test.ts)

## Functionality Summary
- Null schema that validates if the value is null.

## Exported Items
- `NullSchema`
    - **Description**: Class for null validation.
    - **Input**: Message optional.
    - **Output**: Schema instance.
- `null_`
    - **Description**: Function to create a null schema.
    - **Input**: Optional message.
    - **Output**: NullSchema instance.

## Test Cases
- `NullSchema`
    - **Happy Path Cases**
        - [ ] **[NullSchema.happy.1]** Case 1: Execute with null.
            - **Input**: null.
            - **Expected**: Success with null.
    - **Error Cases**
        - [ ] **[NullSchema.error.1]** Case 1: Execute with non-null.
            - **Input**: 42.
            - **Expected**: Failure with EXPECTED_NULL.
- `null_`
    - **Happy Path Cases**
        - [ ] **[null_.happy.1]** Case 1: Create null schema.
            - **Input**: N/A.
            - **Expected**: NullSchema instance.
