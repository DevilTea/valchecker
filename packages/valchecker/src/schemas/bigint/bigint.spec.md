# bigint.spec.md

Source File: `./bigint.ts`
Test File: [`./bigint.test.ts`](./bigint.test.ts)

## Functionality Summary
- Bigint schema for validating that input is a bigint value.

## Exported Items
- `BigintSchemaTypes`
    - **Description**: Type for bigint schema types.
    - **Input**: N/A (type definition).
    - **Output**: DefineSchemaTypes with output bigint, issue code EXPECTED_BIGINT.
- `BigintSchemaMessage`
    - **Description**: Type for messages in bigint schema.
    - **Input**: N/A (type definition).
    - **Output**: SchemaMessage type.
- `BigintSchema`
    - **Description**: Class for bigint validation.
    - **Input**: Optional message.
    - **Output**: Schema instance.
- `bigint`
    - **Description**: Function to create a bigint schema.
    - **Input**: Optional message.
    - **Output**: BigintSchema instance.

## Test Cases
- `BigintSchemaTypes`
    - **Note**: Type-only, not runtime testable.
- `BigintSchemaMessage`
    - **Note**: Type-only, not runtime testable.
- `BigintSchema`
    - **Happy Path Cases**
        - [ ] **[BigintSchema.happy.1]** Case 1: Execute with bigint value.
            - **Input**: Input 42n.
            - **Expected**: Success with 42n.
    - **Error Cases**
        - [ ] **[BigintSchema.error.1]** Case 1: Execute with number value.
            - **Input**: Input 42.
            - **Expected**: Failure with EXPECTED_BIGINT.
        - [ ] **[BigintSchema.error.2]** Case 1: Execute with string value.
            - **Input**: Input '42'.
            - **Expected**: Failure with EXPECTED_BIGINT.
        - [ ] **[BigintSchema.error.3]** Case 1: Execute with boolean value.
            - **Input**: Input true.
            - **Expected**: Failure with EXPECTED_BIGINT.
        - [ ] **[BigintSchema.error.4]** Case 1: Execute with null value.
            - **Input**: Input null.
            - **Expected**: Failure with EXPECTED_BIGINT.
        - [ ] **[BigintSchema.error.5]** Case 1: Execute with undefined value.
            - **Input**: Input undefined.
            - **Expected**: Failure with EXPECTED_BIGINT.
- `bigint`
    - **Happy Path Cases**
        - [ ] **[bigint.happy.1]** Case 1: Create bigint schema.
            - **Input**: No arguments.
            - **Expected**: BigintSchema instance.
