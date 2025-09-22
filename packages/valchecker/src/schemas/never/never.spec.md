# never.spec.md

Source File: `./never.ts`
Test File: [`./never.test.ts`](./never.test.ts)

## Functionality Summary
- Never schema that always fails validation, used for types that should never occur.

## Exported Items
- `NeverSchemaTypes`
    - **Description**: Type for never schema types.
    - **Input**: N/A (type definition).
    - **Output**: DefineSchemaTypes with output never, issue code EXPECTED_NEVER.
- `NeverSchemaMessage`
    - **Description**: Type for messages in never schema.
    - **Input**: N/A (type definition).
    - **Output**: SchemaMessage type.
- `NeverSchema`
    - **Description**: Class for never validation.
    - **Input**: Optional message.
    - **Output**: Schema instance.
- `never`
    - **Description**: Function to create a never schema.
    - **Input**: Optional message.
    - **Output**: NeverSchema instance.

## Test Cases
- `NeverSchemaTypes`
    - **Note**: Type-only, not runtime testable.
- `NeverSchemaMessage`
    - **Note**: Type-only, not runtime testable.
- `NeverSchema`
    - **Error Cases**
        - [ ] **[NeverSchema.error.1]** Case 1: Execute with any value.
            - **Input**: Any value (e.g., 42).
            - **Expected**: Failure with EXPECTED_NEVER.
        - [ ] **[NeverSchema.error.2]** Case 1: Execute with null.
            - **Input**: null.
            - **Expected**: Failure with EXPECTED_NEVER.
        - [ ] **[NeverSchema.error.3]** Case 1: Execute with undefined.
            - **Input**: undefined.
            - **Expected**: Failure with EXPECTED_NEVER.
- `never`
    - **Happy Path Cases**
        - [ ] **[never.happy.1]** Case 1: Create never schema without message.
            - **Input**: No arguments.
            - **Expected**: NeverSchema instance.
        - [ ] **[never.happy.2]** Case 1: Create never schema with message.
            - **Input**: message.
            - **Expected**: NeverSchema instance with message.
